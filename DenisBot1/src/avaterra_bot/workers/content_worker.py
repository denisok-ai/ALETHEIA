"""
@file: content_worker.py
@description: APScheduler задачи Content Planner и Publisher (Пн/Ср/Пт)
@dependencies: apscheduler, aiogram
@created: 2026-05-07
"""

from __future__ import annotations

import logging
import os
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Awaitable, Callable
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.brand import ensure_default_brand_profile
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    get_item,
    list_items_for_date,
    reset_item_for_regeneration,
)
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.services.external.deepseek import DeepSeekClient
from avaterra_bot.services.external.kie import KieClient
from avaterra_bot.services.generator.pipeline import (
    complete_image_for_item,
    prepare_item,
)
from avaterra_bot.services.planner.content_planner import upcoming_week_monday
from avaterra_bot.services.planner.weekly_notify import (
    notify_weekly_pipeline_failure,
    notify_weekly_pipeline_result,
)
from avaterra_bot.services.planner.weekly_orchestrator import run_weekly_pipeline
from avaterra_bot.services.publisher.channel_publisher import (
    _dry_run_reasons,
    publish_due_today,
    today_in_timezone,
)
from avaterra_bot.services.quality.gates import scan_publish_blockers
from avaterra_bot.workers.site_radar_worker import (
    DEFAULT_PROJECT_NAME,
    DEFAULT_WEBSITE_URL,
)

_PENDING_ITEMS_PREVIEW = 10
_PREFLIGHT_RECOVERABLE_STATUSES = frozenset(
    {"draft", "text_ready", "quality_failed", "failed", "dedup_blocked"}
)
_PUBLISH_STATUSES_READY = frozenset({"approved", "ready"})
_TRUE_ENV_VALUES = frozenset({"true", "1", "yes", "on"})


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in _TRUE_ENV_VALUES


def _reconcile_publisher_flags(settings: AppSettings) -> dict[str, dict[str, bool]]:
    """Сбросить runtime-флаги публикатора к значениям из окружения.

    После инцидента 15–17.05.2026 in-memory toggle (`/dry_run on`,
    `adm:dry`/`adm:auto`) мог тихо отключить публикацию до перезапуска
    контейнера. Для автономности (посты должны выходить ежедневно без
    ручного вмешательства) перед каждым слотом сверяемся с `.env`:
    если в памяти стоит «не публиковать», а в окружении «публиковать» —
    возвращаемся к окружению. Возвращает структурированный diff с
    предыдущим и новым значением для лога/уведомления.
    """
    drift: dict[str, dict[str, bool]] = {}
    env_dry = _env_bool("DRY_RUN", default=settings.dry_run)
    env_auto = _env_bool("ENABLE_AUTO_PUBLISH", default=settings.enable_auto_publish)
    if settings.dry_run != env_dry:
        drift["dry_run"] = {"runtime": settings.dry_run, "env": env_dry}
        settings.dry_run = env_dry
    if settings.enable_auto_publish != env_auto:
        drift["enable_auto_publish"] = {
            "runtime": settings.enable_auto_publish,
            "env": env_auto,
        }
        settings.enable_auto_publish = env_auto
    return drift

logger = logging.getLogger(__name__)

DEFAULT_PLANNER_DAY_OF_WEEK = "sun"
DEFAULT_PLANNER_HOUR = 19
DEFAULT_PUBLISHER_DAY_OF_WEEK_7 = "mon,tue,wed,thu,fri,sat,sun"
DEFAULT_PUBLISHER_DAY_OF_WEEK_3 = "mon,wed,fri"
_PUBLISHER_MISFIRE_GRACE_SECONDS = 6 * 60 * 60
_STARTUP_CATCHUP_DELAY_SECONDS = 60


async def _try_recover_item(
    pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    brand,
    settings: AppSettings,
    deepseek: DeepSeekClient,
    kie: KieClient,
) -> str:
    """Восстановить один застрявший item к моменту слота.

    Стратегия отражает `weekly_orchestrator._process_item`, но дополнительно
    сбрасывает retry_count для `quality_failed/failed/dedup_blocked`, чтобы
    дать чистую попытку прямо перед публикацией.
    """
    try:
        if item.status == "text_ready":
            outcome = await complete_image_for_item(
                pool,
                project_id=project_id,
                item=item,
                settings=settings,
                kie=kie,
            )
        else:
            if item.status in {"quality_failed", "failed", "dedup_blocked"}:
                await reset_item_for_regeneration(pool, item_id=item.id)
                item = await get_item(pool, item.id) or item
            outcome = await prepare_item(
                pool,
                project_id=project_id,
                item=item,
                brand=brand,
                settings=settings,
                deepseek=deepseek,
                kie=kie,
            )
    except Exception:
        logger.exception(
            "publisher_preflight_item_failed",
            extra={
                "item_id": item.id,
                "post_type": item.post_type,
                "from_status": item.status,
            },
        )
        return "error"
    return outcome.status


async def run_publisher_preflight(
    pool,
    *,
    project_id: str,
    settings: AppSettings,
    day: date,
) -> dict:
    """Дотянуть сегодняшние item'ы до публикабельного состояния.

    Это последняя сетка безопасности перед слотом 11:00 МСК: если
    недельный пайплайн оставил пост в `draft/text_ready/quality_failed/...`,
    публикатор не должен молча пропускать день — пробуем подготовить
    item прямо сейчас. Возвращает структурированный отчёт для лога.
    """
    items = await list_items_for_date(
        pool, project_id=project_id, publish_date=day
    )
    if not items:
        return {"recoverable": 0, "recovered": 0, "items": []}

    recoverable: list[ContentItemRecord] = []
    forced_reset: list[str] = []
    for item in items:
        if item.status in _PREFLIGHT_RECOVERABLE_STATUSES:
            recoverable.append(item)
            continue
        if item.status in _PUBLISH_STATUSES_READY:
            text = (item.final_text or item.generated_text or "").strip()
            if not text:
                continue
            blockers = scan_publish_blockers(text)
            if not blockers:
                continue
            codes = sorted({issue.code for issue in blockers})
            logger.warning(
                "publisher_preflight_ready_blocked",
                extra={
                    "item_id": item.id,
                    "post_type": item.post_type,
                    "issues": codes,
                },
            )
            await reset_item_for_regeneration(pool, item_id=item.id)
            refreshed = await get_item(pool, item.id)
            if refreshed is not None:
                recoverable.append(refreshed)
                forced_reset.append(item.id)
    if not recoverable:
        return {"recoverable": 0, "recovered": 0, "items": []}

    brand = await ensure_default_brand_profile(pool, project_id)
    deepseek = DeepSeekClient(settings)
    kie = KieClient(settings)

    report: list[dict] = []
    recovered = 0
    for item in recoverable:
        from_status = item.status
        new_status = await _try_recover_item(
            pool,
            project_id=project_id,
            item=item,
            brand=brand,
            settings=settings,
            deepseek=deepseek,
            kie=kie,
        )
        entry = {
            "item_id": item.id,
            "post_type": item.post_type,
            "from_status": from_status,
            "to_status": new_status,
        }
        report.append(entry)
        if new_status in _PUBLISH_STATUSES_READY:
            recovered += 1

    logger.warning(
        "publisher_preflight_outcome",
        extra={
            "date": day.isoformat(),
            "recoverable": len(recoverable),
            "recovered": recovered,
            "forced_reset": forced_reset,
            "items": report,
        },
    )
    return {
        "recoverable": len(recoverable),
        "recovered": recovered,
        "forced_reset": forced_reset,
        "items": report,
    }


async def _log_pending_items_for_date(pool, project_id: str, day: date) -> None:
    """Объяснить, почему публикатор не нашёл ни одного готового поста.

    Без этой диагностики `publisher_run_empty` молчит, и приходится лезть в БД.
    Логируем сводку по статусам и список первых N item'ов с их статусом,
    чтобы инцидент уровня «faq застрял в draft» был виден прямо в логах слота.
    """
    try:
        items = await list_items_for_date(
            pool, project_id=project_id, publish_date=day
        )
    except Exception:
        logger.exception(
            "publisher_run_empty_diagnostic_failed",
            extra={"date": day.isoformat()},
        )
        return

    if not items:
        logger.warning(
            "publisher_run_empty",
            extra={
                "date": day.isoformat(),
                "reason": "no_items_in_plan",
                "items_total": 0,
            },
        )
        return

    counts = Counter(item.status for item in items)
    preview = [
        {
            "item_id": item.id,
            "post_type": item.post_type,
            "status": item.status,
        }
        for item in items[:_PENDING_ITEMS_PREVIEW]
    ]
    logger.warning(
        "publisher_run_empty",
        extra={
            "date": day.isoformat(),
            "reason": "no_due_items",
            "items_total": len(items),
            "status_counts": dict(counts),
            "items_preview": preview,
        },
    )


def _safe_int(value: str | int | None) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


async def attach_content_jobs(
    bot: Bot,
    settings: AppSettings,
    pool,
    scheduler: AsyncIOScheduler,
) -> str:
    """Добавить в существующий планировщик задачи Planner и Publisher."""
    target_channel = _safe_int(settings.target_channel_id) or 0
    project = await ensure_default_project(
        pool,
        name=DEFAULT_PROJECT_NAME,
        website_url=DEFAULT_WEBSITE_URL,
        channel_id=target_channel,
        timezone=settings.timezone,
    )

    async def _planner_job() -> None:
        if not settings.weekly_planner_enabled:
            return
        target_monday = upcoming_week_monday(date.today())
        try:
            outcome = await run_weekly_pipeline(
                bot,
                pool,
                project_id=project.id,
                settings=settings,
                target_monday=target_monday,
            )
        except Exception as exc:
            logger.exception(
                "weekly_pipeline_crashed",
                extra={"target_monday": target_monday.isoformat()},
            )
            await notify_weekly_pipeline_failure(
                bot, settings, exc, target_monday=target_monday.isoformat()
            )
            return
        logger.info(
            "weekly_pipeline_done",
            extra={
                "plan_id": outcome.plan_id,
                "target_monday": target_monday.isoformat(),
                "items_total": outcome.items_total,
                "items_prepared": outcome.items_prepared,
                "items_blocked": outcome.items_blocked,
                "ready_count": outcome.ready_count,
                "all_ready": outcome.all_ready,
                "passes_run": outcome.passes_run,
            },
        )
        await notify_weekly_pipeline_result(bot, settings, outcome)

    async def _run_publisher_slot(*, source: str) -> None:
        """Слот публикации: reconcile флагов → preflight → публикация.

        `source` отличает регулярный cron-вызов от startup-catchup.
        Любая ошибка ловится и логируется, slot никогда не падает наружу.
        """
        today = today_in_timezone(settings.timezone)
        drift = _reconcile_publisher_flags(settings)
        if drift:
            logger.warning(
                "publisher_flags_reverted",
                extra={
                    "date": today.isoformat(),
                    "source": source,
                    "drift": drift,
                },
            )
        reasons = _dry_run_reasons(settings)
        logger.info(
            "publisher_run_state",
            extra={
                "source": source,
                "date": today.isoformat(),
                "timezone": settings.timezone,
                "publish_mode": settings.publish_mode,
                "dry_run": settings.dry_run,
                "enable_auto_publish": settings.enable_auto_publish,
                "has_channel": bool((settings.target_channel_id or "").strip()),
                "posts_per_week": settings.posts_per_week,
                "dry_run_reasons": reasons,
            },
        )
        try:
            await run_publisher_preflight(
                pool, project_id=project.id, settings=settings, day=today
            )
        except Exception:
            logger.exception(
                "publisher_preflight_failed", extra={"date": today.isoformat()}
            )
        try:
            outcomes = await publish_due_today(
                bot, pool, project_id=project.id, settings=settings, today=today
            )
        except Exception:
            logger.exception(
                "publisher_job_crashed", extra={"date": today.isoformat()}
            )
            return
        published = sum(1 for o in outcomes if o.status == "published")
        admin_preview_sent = sum(
            1 for o in outcomes if o.status == "admin_preview_sent"
        )
        if not outcomes:
            await _log_pending_items_for_date(pool, project.id, today)
        logger.info(
            "publisher_run_done",
            extra={
                "source": source,
                "date": today.isoformat(),
                "items": len(outcomes),
                "published": published,
                "admin_preview_sent": admin_preview_sent,
                "dry_run": sum(1 for o in outcomes if o.dry_run),
                "failed": sum(1 for o in outcomes if o.status == "failed"),
            },
        )

    async def _publisher_job() -> None:
        await _run_publisher_slot(source="cron")

    planner_callable: Callable[[], Awaitable[None]] = _planner_job
    publisher_callable: Callable[[], Awaitable[None]] = _publisher_job

    scheduler.add_job(
        planner_callable,
        trigger=CronTrigger(
            day_of_week=DEFAULT_PLANNER_DAY_OF_WEEK,
            hour=DEFAULT_PLANNER_HOUR,
            minute=0,
            timezone=settings.timezone,
        ),
        id="content_planner_weekly",
        name="Weekly content plan + generation",
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=300),
    )
    publisher_days = (
        DEFAULT_PUBLISHER_DAY_OF_WEEK_7
        if settings.posts_per_week >= 7
        else DEFAULT_PUBLISHER_DAY_OF_WEEK_3
    )
    publisher_name = (
        "Channel publisher daily 7/7"
        if settings.posts_per_week >= 7
        else "Channel publisher Mon/Wed/Fri"
    )
    scheduler.add_job(
        publisher_callable,
        trigger=CronTrigger(
            day_of_week=publisher_days,
            hour=settings.publish_hour,
            minute=settings.publish_minute,
            timezone=settings.timezone,
        ),
        id="content_publisher_daily",
        name=publisher_name,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=_PUBLISHER_MISFIRE_GRACE_SECONDS,
    )

    catchup_scheduled = _maybe_schedule_startup_catchup(
        scheduler,
        settings=settings,
        run_slot=_run_publisher_slot,
    )

    logger.info(
        "content_jobs_scheduled",
        extra={
            "planner_cron": f"{DEFAULT_PLANNER_DAY_OF_WEEK} {DEFAULT_PLANNER_HOUR}:00",
            "publisher_cron": (
                f"{publisher_days} "
                f"{settings.publish_hour:02d}:{settings.publish_minute:02d}"
            ),
            "timezone": settings.timezone,
            "posts_per_week": settings.posts_per_week,
            "dry_run": settings.dry_run,
            "enable_auto_publish": settings.enable_auto_publish,
            "has_channel": bool((settings.target_channel_id or "").strip()),
            "dry_run_reasons": _dry_run_reasons(settings),
            "publisher_misfire_grace_seconds": _PUBLISHER_MISFIRE_GRACE_SECONDS,
            "startup_catchup_scheduled": catchup_scheduled,
        },
    )
    return project.id


def _maybe_schedule_startup_catchup(
    scheduler: AsyncIOScheduler,
    *,
    settings: AppSettings,
    run_slot: Callable[..., Awaitable[None]],
) -> bool:
    """Если бот поднялся уже после `publish_hour:publish_minute`, запустить
    одноразовый слот через `_STARTUP_CATCHUP_DELAY_SECONDS`.

    Покрывает случай рестарта/деплоя около слота, когда misfire_grace
    не сработал (например, перезапуск >6 ч назад). Дополнительно даёт
    публикатору шанс «догнать» сегодняшний день без ручных команд.
    """
    publisher_days_7 = settings.posts_per_week >= 7
    try:
        tz_name = settings.timezone
        now_local = today_in_timezone(tz_name)
        now_dt = datetime.now(ZoneInfo(tz_name))
    except (ZoneInfoNotFoundError, ValueError):
        return False
    slot_today = now_dt.replace(
        hour=settings.publish_hour,
        minute=settings.publish_minute,
        second=0,
        microsecond=0,
    )
    if now_dt < slot_today:
        return False
    weekday = now_local.weekday()
    if not publisher_days_7 and weekday not in {0, 2, 4}:
        return False

    async def _catchup() -> None:
        await run_slot(source="startup_catchup")

    run_at = datetime.now(timezone.utc) + timedelta(
        seconds=_STARTUP_CATCHUP_DELAY_SECONDS
    )
    scheduler.add_job(
        _catchup,
        trigger=DateTrigger(run_date=run_at),
        id="content_publisher_startup_catchup",
        name="Channel publisher startup catch-up",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    logger.info(
        "publisher_startup_catchup_scheduled",
        extra={
            "scheduled_at": run_at.isoformat(),
            "now_local": now_dt.isoformat(),
            "slot_today": slot_today.isoformat(),
        },
    )
    return True
