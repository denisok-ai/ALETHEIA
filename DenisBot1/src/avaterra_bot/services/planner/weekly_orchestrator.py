"""
@file: weekly_orchestrator.py
@description: Многоходовой недельный пайплайн: план + генерация постов с ретраями и сверкой 7/7
@dependencies: planner, generator, brand
@created: 2026-05-07
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional

import asyncpg
from aiogram import Bot

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.brand import (
    BrandProfile,
    ensure_default_brand_profile,
)
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    list_plan_items,
    update_item_status,
)
from avaterra_bot.services.external.deepseek import DeepSeekClient
from avaterra_bot.services.external.kie import KieClient
from avaterra_bot.services.generator.pipeline import (
    PreparationOutcome,
    complete_image_for_item,
    prepare_item,
)
from avaterra_bot.services.planner.content_planner import (
    WeekPlan,
    build_week_plan,
)

logger = logging.getLogger(__name__)


PASS1_STATUSES = frozenset(
    {"draft", "failed", "dedup_blocked", "quality_failed"}
)
# draft включён: если pass1 упал исключением до смены статуса, item
# остаётся draft — без него доп. проход его больше не трогает (инцидент 6/7).
RETRY_STATUSES = frozenset(
    {"draft", "quality_failed", "failed", "dedup_blocked"}
)
TEXT_READY_STATUS = "text_ready"
READY_STATUSES = frozenset(
    {"ready", "approved", "published", "admin_preview_sent"}
)


@dataclass
class ProblemItem:
    item_id: str
    publish_date: date
    post_type: str
    status: str
    reason: str


@dataclass
class WeeklyOutcome:
    plan_id: str
    week_start: date
    week_end: date
    items_total: int
    items_prepared: int
    items_blocked: int
    ready_count: int
    passes_run: int
    all_ready: bool
    problem_items: list[ProblemItem] = field(default_factory=list)
    outcomes: list[PreparationOutcome] = field(default_factory=list)


async def _process_item(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    brand: BrandProfile,
    settings: AppSettings,
    deepseek: DeepSeekClient,
    kie: KieClient,
) -> Optional[PreparationOutcome]:
    """Подобрать стратегию обработки одного item в зависимости от его статуса."""
    if item.status == TEXT_READY_STATUS:
        return await complete_image_for_item(
            pool,
            project_id=project_id,
            item=item,
            settings=settings,
            kie=kie,
        )
    return await prepare_item(
        pool,
        project_id=project_id,
        item=item,
        brand=brand,
        settings=settings,
        deepseek=deepseek,
        kie=kie,
    )


async def _run_single_pass(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    plan_id: str,
    target_statuses: frozenset[str],
    brand: BrandProfile,
    settings: AppSettings,
    deepseek: DeepSeekClient,
    kie: KieClient,
    pass_label: str,
) -> tuple[list[PreparationOutcome], int, int]:
    """Один проход по items: обработать всех с подходящим статусом."""
    items = await list_plan_items(pool, plan_id)
    outcomes: list[PreparationOutcome] = []
    prepared = 0
    blocked = 0
    for item in items:
        if item.status not in target_statuses:
            continue
        try:
            outcome = await _process_item(
                pool,
                project_id=project_id,
                item=item,
                brand=brand,
                settings=settings,
                deepseek=deepseek,
                kie=kie,
            )
        except Exception as exc:
            logger.exception(
                "weekly_pipeline_item_failed",
                extra={
                    "item_id": item.id,
                    "pass": pass_label,
                    "from_status": item.status,
                },
            )
            error_marker = f"{type(exc).__name__}: {str(exc)[:180]}"
            try:
                await update_item_status(
                    pool,
                    item_id=item.id,
                    status="failed",
                    last_error=error_marker,
                )
            except Exception:
                logger.exception(
                    "weekly_pipeline_mark_failed_error",
                    extra={"item_id": item.id, "pass": pass_label},
                )
            continue
        if outcome is None:
            continue
        outcomes.append(outcome)
        if outcome.status in {"dedup_blocked", "quality_failed"}:
            blocked += 1
        else:
            prepared += 1
    logger.info(
        "weekly_pipeline_pass_done",
        extra={
            "plan_id": plan_id,
            "pass": pass_label,
            "items_handled": len(outcomes),
            "prepared": prepared,
            "blocked": blocked,
        },
    )
    return outcomes, prepared, blocked


def _verify_plan(
    items: list[ContentItemRecord],
    *,
    week_start: date,
    week_end: date,
    posts_per_week: int,
) -> tuple[int, bool, list[ProblemItem]]:
    """Посчитать готовые посты и собрать список проблемных позиций.

    Для `posts_per_week == 7` дополнительно проверяем, что на каждый день
    недели есть хотя бы один item в финальном статусе.
    """
    ready_count = 0
    problems: list[ProblemItem] = []
    items_by_date: dict[date, list[ContentItemRecord]] = {}
    for item in items:
        items_by_date.setdefault(item.publish_date, []).append(item)
        if item.status in READY_STATUSES:
            ready_count += 1
        else:
            problems.append(
                ProblemItem(
                    item_id=item.id,
                    publish_date=item.publish_date,
                    post_type=item.post_type,
                    status=item.status,
                    reason=(item.last_error or item.dedup_reason or item.status),
                )
            )

    if posts_per_week >= 7:
        day_cursor = week_start
        while day_cursor <= week_end:
            day_items = items_by_date.get(day_cursor) or []
            # Только пустой день: non-ready item уже в problems выше —
            # не дублируем «missing» рядом с «draft/quality_failed».
            if not day_items:
                problems.append(
                    ProblemItem(
                        item_id="",
                        publish_date=day_cursor,
                        post_type="—",
                        status="missing",
                        reason="нет готового поста на этот день",
                    )
                )
            day_cursor += timedelta(days=1)

    all_ready = not problems
    return ready_count, all_ready, problems


async def run_weekly_pipeline(
    bot: Bot,
    pool: asyncpg.Pool,
    *,
    project_id: str,
    settings: AppSettings,
    target_monday: Optional[date] = None,
) -> WeeklyOutcome:
    """План на неделю + многоходовая генерация всех постов.

    Pass 1 обрабатывает свежий план и повторный запуск
    (`draft`, `failed`, `dedup_blocked`, `quality_failed`).
    Дополнительные проходы (см. `weekly_pipeline_extra_passes`) повторно
    обрабатывают те же статусы (полный `prepare_item`) и `text_ready`
    (только догенерация картинки).
    Exception в проходе переводит item в `failed` с `last_error`.
    После всех проходов делается сверка плана и собирается список проблем.
    """
    brand = await ensure_default_brand_profile(pool, project_id)
    plan_obj: WeekPlan = await build_week_plan(
        pool,
        project_id,
        posts_per_week=settings.posts_per_week,
        target_monday=target_monday,
    )

    deepseek = DeepSeekClient(settings)
    kie = KieClient(settings)

    aggregated: list[PreparationOutcome] = []
    total_prepared = 0
    total_blocked = 0

    pass1_outcomes, prepared1, blocked1 = await _run_single_pass(
        pool,
        project_id=project_id,
        plan_id=plan_obj.plan.id,
        target_statuses=PASS1_STATUSES,
        brand=brand,
        settings=settings,
        deepseek=deepseek,
        kie=kie,
        pass_label="pass1",
    )
    aggregated.extend(pass1_outcomes)
    total_prepared += prepared1
    total_blocked += blocked1
    passes_run = 1

    extra_passes = max(0, settings.weekly_pipeline_extra_passes)
    retry_pass_statuses = RETRY_STATUSES | {TEXT_READY_STATUS}
    for extra_index in range(extra_passes):
        remaining = [
            item
            for item in await list_plan_items(pool, plan_obj.plan.id)
            if item.status not in READY_STATUSES
        ]
        if not remaining:
            break
        if settings.weekly_pipeline_pass_delay_seconds > 0:
            await asyncio.sleep(settings.weekly_pipeline_pass_delay_seconds)
        pass_label = f"pass{extra_index + 2}"
        pass_outcomes, prepared_n, blocked_n = await _run_single_pass(
            pool,
            project_id=project_id,
            plan_id=plan_obj.plan.id,
            target_statuses=retry_pass_statuses,
            brand=brand,
            settings=settings,
            deepseek=deepseek,
            kie=kie,
            pass_label=pass_label,
        )
        passes_run += 1
        if not pass_outcomes:
            logger.info(
                "weekly_pipeline_pass_empty",
                extra={"plan_id": plan_obj.plan.id, "pass": pass_label},
            )
            break
        aggregated.extend(pass_outcomes)
        total_prepared += prepared_n
        total_blocked += blocked_n

    final_items = await list_plan_items(pool, plan_obj.plan.id)
    ready_count, all_ready, problem_items = _verify_plan(
        final_items,
        week_start=plan_obj.plan.week_start,
        week_end=plan_obj.plan.week_end,
        posts_per_week=settings.posts_per_week,
    )

    logger.info(
        "weekly_pipeline_summary",
        extra={
            "plan_id": plan_obj.plan.id,
            "passes_run": passes_run,
            "items_total": len(final_items),
            "ready_count": ready_count,
            "all_ready": all_ready,
            "problem_count": len(problem_items),
        },
    )

    return WeeklyOutcome(
        plan_id=plan_obj.plan.id,
        week_start=plan_obj.plan.week_start,
        week_end=plan_obj.plan.week_end,
        items_total=len(final_items),
        items_prepared=total_prepared,
        items_blocked=total_blocked,
        ready_count=ready_count,
        passes_run=passes_run,
        all_ready=all_ready,
        problem_items=problem_items,
        outcomes=aggregated,
    )
