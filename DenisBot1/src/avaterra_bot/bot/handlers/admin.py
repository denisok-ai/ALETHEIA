"""
@file: admin.py
@description: Админ-команды бота (Site Radar + Content Pipeline + Publisher)
@dependencies: aiogram, asyncpg, apscheduler
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

from aiogram import Bot, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandObject
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from avaterra_bot import __version__
from avaterra_bot.bot.middleware.admin_acl import AdminOnlyMiddleware
from avaterra_bot.config import get_settings
from avaterra_bot.db.repositories.brand import (
    ensure_default_brand_profile,
    get_brand_profile,
)
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    get_current_week_plan,
    get_item,
    latest_quality_codes,
    list_due_items,
    list_items_by_status,
    list_plan_items,
    reset_item_for_regeneration,
    update_item_status,
)
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.db.repositories.site_signals import (
    SiteSignalListItem,
    count_signals_audit,
    list_signals_audit,
)
from avaterra_bot.services.external.deepseek import DeepSeekClient
from avaterra_bot.services.external.kie import KieClient
from avaterra_bot.services.generator.pipeline import prepare_item
from avaterra_bot.services.knowledge.loader import apply_kb_to_project
from avaterra_bot.services.planner.content_planner import (
    build_week_plan,
    week_bounds,
)
from avaterra_bot.services.planner.weekly_orchestrator import run_weekly_pipeline
from avaterra_bot.services.publisher.channel_publisher import (
    publish_due_today,
    publish_item,
)
from avaterra_bot.services.site_radar.orchestrator import SiteRadarOrchestrator
from avaterra_bot.workers.site_radar_worker import (
    DEFAULT_PRIORITY_URLS,
    DEFAULT_PROJECT_NAME,
    DEFAULT_WEBSITE_URL,
)

logger = logging.getLogger(__name__)

router = Router(name="admin")
router.message.middleware(AdminOnlyMiddleware())
router.callback_query.middleware(AdminOnlyMiddleware())

_pool = None
_scheduler: Optional[AsyncIOScheduler] = None
_project_id: Optional[str] = None


def bind_pool(pool) -> None:
    global _pool
    _pool = pool


def bind_scheduler(scheduler: AsyncIOScheduler) -> None:
    global _scheduler
    _scheduler = scheduler


def bind_project_id(project_id: str) -> None:
    global _project_id
    _project_id = project_id


async def _ensure_project_id() -> str:
    global _project_id
    if _project_id:
        return _project_id
    settings = get_settings()
    target = int(settings.target_channel_id) if settings.target_channel_id else 0
    project = await ensure_default_project(
        _pool,
        name=DEFAULT_PROJECT_NAME,
        website_url=DEFAULT_WEBSITE_URL,
        channel_id=target,
        timezone=settings.timezone,
    )
    _project_id = project.id
    return _project_id


@router.message(Command("admin_help"))
async def cmd_admin_help(message: Message) -> None:
    await message.answer(
        "Админ-команды:\n"
        "/admin - открыть меню админа\n"
        "/status - статус сервиса\n"
        "/radar - расписание Site Radar\n"
        "/radar_now - запустить полный обход сайта\n"
        "/radar_signals [high|medium|all] [page] - аудит сигналов радара\n"
        "/plan - текущий план недели\n"
        "/plan_now - построить план + сгенерировать все посты\n"
        "/quality_queue - очередь quality_failed постов\n"
        "/preview <id> - предпросмотр поста\n"
        "/regenerate <id> - перегенерировать пост (после quality_failed)\n"
        "/approve <id> - перевести пост в `approved`\n"
        "/publish_now - опубликовать готовые посты на сегодня\n"
        "/dry_run on|off - переключить режим dry-run (in-memory)\n"
        "/auto on|off - включить/выключить авто-публикацию (in-memory)\n"
        "/pause - поставить scheduler на паузу\n"
        "/resume - возобновить scheduler\n"
        "/kb_load - перечитать knowledge/avaterra.yaml в БД\n"
        "/kb_show - показать сводку базы знаний\n"
        "/stats - сводка за последние 7 дней\n"
        "/stats_full - детальная статистика опубликованных постов\n"
        "/stat <id> <views> [reactions] [comments] [saves] [ctr] - ввести "
        "статистику для поста"
    )


@router.message(Command("kb_load"))
async def cmd_kb_load(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    settings = get_settings()
    project_id = await _ensure_project_id()
    kb_path = settings.kb_yaml_path
    if not kb_path.exists():
        await message.answer(f"KB файл не найден: {kb_path}")
        return
    try:
        _, outcome = await apply_kb_to_project(
            _pool, project_id=project_id, kb_path=kb_path
        )
    except Exception as exc:
        await message.answer(f"KB не применилась: {exc}")
        return
    await message.answer(
        "KB применена.\n"
        f"version: {outcome.kb_version}\n"
        f"audiences: {outcome.audiences}, rubrics: {outcome.rubrics}, "
        f"templates: {outcome.post_types}\n"
        f"theme_pool: добавлено {outcome.themes_inserted}, обновлено {outcome.themes_updated}"
    )


@router.message(Command("kb_show"))
async def cmd_kb_show(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    project_id = await _ensure_project_id()
    profile = await get_brand_profile(_pool, project_id)
    if profile is None:
        await message.answer("Brand profile ещё не создан.")
        return
    audiences = ", ".join(a.get("id", "?") for a in profile.audiences) or "-"
    products = ", ".join(profile.products.keys()) if profile.products else "-"
    rubrics = ", ".join(r.get("id", "?") for r in profile.rubrics) or "-"
    templates = ", ".join(t.get("id", "?") for t in profile.templates) or "-"
    cta_kinds = ", ".join(profile.cta_library.keys()) if profile.cta_library else "-"
    await message.answer(
        "<b>Avaterra KB</b>\n"
        f"version: <code>{profile.kb_version or '-'}</code>\n"
        f"ToV: {profile.tone_of_voice[:140]}…\n"
        f"audiences: {audiences}\n"
        f"products: {products}\n"
        f"rubrics: {rubrics}\n"
        f"templates: {templates}\n"
        f"cta_library: {cta_kinds}\n"
        f"prohibited_phrases: {len(profile.prohibited_phrases)}\n"
        f"safe_replacements: {len(profile.safe_replacements)}\n"
        f"disclaimer triggers: {len(profile.disclaimer.get('triggers', []) or [])}"
    )


@router.message(Command("status"))
async def cmd_status(message: Message) -> None:
    settings = get_settings()
    parts = [
        "OK. Сервис активен.",
        f"timezone: {settings.timezone}",
        f"scheduler_enabled: {settings.scheduler_enabled}",
        f"db_pool: {'ready' if _pool else 'not ready'}",
        f"scheduler: {'running' if _scheduler else 'off'}",
        f"dry_run: {settings.dry_run}",
        f"enable_auto_publish: {settings.enable_auto_publish}",
        f"target_channel_id: {settings.target_channel_id or '-'}",
    ]
    await message.answer("\n".join(parts))


@router.message(Command("radar"))
async def cmd_radar_status(message: Message) -> None:
    if _scheduler is None:
        await message.answer("Scheduler выключен.")
        return
    lines = ["Scheduled jobs:"]
    for job in _scheduler.get_jobs():
        next_run = job.next_run_time.isoformat() if job.next_run_time else "-"
        lines.append(f"- {job.id}: next_run={next_run}")
    await message.answer("\n".join(lines))


@router.message(Command("radar_now"))
async def cmd_radar_now(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    settings = get_settings()
    project_id = await _ensure_project_id()
    orchestrator = SiteRadarOrchestrator(
        pool=_pool,
        bot=message.bot,
        settings=settings,
        project_id=project_id,
        website_url=DEFAULT_WEBSITE_URL,
        priority_urls=DEFAULT_PRIORITY_URLS,
    )
    await message.answer("Запускаю полный обход.")
    stats = await orchestrator.run_full_cycle()
    await message.answer(
        "Site Radar результат:\n"
        f"страниц: {stats.pages_seen} (изменено {stats.pages_changed})\n"
        f"новые URL: {stats.new_urls}, удалённые: {stats.removed_urls}\n"
        f"сигналов: {stats.signals_total} "
        f"(high {stats.signals_high}, medium {stats.signals_medium}, "
        f"low {stats.signals_low})\n"
        f"шумовых блоков: {stats.noise_blocks} "
        f"(noise_share={int(stats.noise_share * 100)}%)\n"
        f"идей в theme_pool: {stats.themes_added} "
        f"(дубли отброшены: {stats.themes_rejected_dup})\n"
        f"уведомлений админам: {stats.notifications_sent}"
    )


@router.message(Command("plan"))
async def cmd_plan(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    project_id = await _ensure_project_id()
    monday, sunday = week_bounds(date.today())
    plan_obj = await build_week_plan(_pool, project_id)
    items = await list_plan_items(_pool, plan_obj.plan.id)
    if not items:
        await message.answer(f"Плана на {monday}-{sunday} нет.")
        return
    lines = [f"Контент-план {monday} - {sunday}:"]
    for item in items:
        short_topic = (item.topic[:80] + "…") if len(item.topic) > 80 else item.topic
        lines.append(
            f"- [{item.publish_date.strftime('%a %d.%m')}] "
            f"[{item.post_type}] {item.status} | {short_topic}\n  id={item.id}"
        )
    await message.answer("\n".join(lines)[:3500])


@router.message(Command("plan_now"))
async def cmd_plan_now(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    settings = get_settings()
    project_id = await _ensure_project_id()
    await ensure_default_brand_profile(_pool, project_id)
    await message.answer("Запускаю план недели и генерацию постов.")
    outcome = await run_weekly_pipeline(
        message.bot, _pool, project_id=project_id, settings=settings
    )
    await message.answer(
        "Готово.\n"
        f"plan_id: {outcome.plan_id}\n"
        f"всего постов: {outcome.items_total}\n"
        f"подготовлено: {outcome.items_prepared}\n"
        f"заблокировано антидублями: {outcome.items_blocked}"
    )


@router.message(Command("preview"))
async def cmd_preview(message: Message, command: CommandObject) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    args = (command.args or "").strip()
    if not args:
        await message.answer("Использование: /preview <content_item_id>")
        return
    item: ContentItemRecord | None = await get_item(_pool, args)
    if item is None:
        await message.answer("Пост не найден.")
        return
    text = item.final_text or item.generated_text or "(текст ещё не сгенерирован)"
    header = (
        f"Превью {item.post_type} | {item.publish_date} | status={item.status}\n"
        f"Тема: {item.topic}\n"
        f"Цель: {item.objective}\n\n"
    )
    body = (header + text)[:3900]
    if item.image_url:
        try:
            await message.bot.send_photo(
                chat_id=message.chat.id,
                photo=item.image_url,
                caption=body[:1024],
            )
            if len(body) > 1024:
                await message.answer(body[1024:])
        except Exception:
            await message.answer(body)
    else:
        await message.answer(body)


@router.message(Command("approve"))
async def cmd_approve(message: Message, command: CommandObject) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    args = (command.args or "").strip()
    if not args:
        await message.answer("Использование: /approve <content_item_id>")
        return
    user_id = message.from_user.id if message.from_user else None
    await update_item_status(
        _pool, item_id=args, status="approved", approved_by=user_id
    )
    await message.answer(f"Item {args} переведён в approved.")


@router.message(Command("publish_now"))
async def cmd_publish_now(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    settings = get_settings()
    project_id = await _ensure_project_id()
    outcomes = await publish_due_today(
        message.bot, _pool, project_id=project_id, settings=settings
    )
    if not outcomes:
        await message.answer("На сегодня нет постов в статусе approved/ready.")
        return
    lines = [f"Опубликовано items: {len(outcomes)}"]
    for o in outcomes:
        lines.append(
            f"- {o.item_id[:8]}…: status={o.status} dry_run={o.dry_run} "
            f"msg_id={o.message_id}"
        )
    await message.answer("\n".join(lines))


@router.message(Command("dry_run"))
async def cmd_dry_run(message: Message, command: CommandObject) -> None:
    args = (command.args or "").strip().lower()
    settings = get_settings()
    if args == "on":
        settings.dry_run = True
    elif args == "off":
        settings.dry_run = False
    else:
        await message.answer(
            f"Сейчас dry_run={settings.dry_run}. Использование: /dry_run on|off"
        )
        return
    await message.answer(f"dry_run переключён в {settings.dry_run}.")


@router.message(Command("auto"))
async def cmd_auto(message: Message, command: CommandObject) -> None:
    args = (command.args or "").strip().lower()
    settings = get_settings()
    if args == "on":
        settings.enable_auto_publish = True
    elif args == "off":
        settings.enable_auto_publish = False
    else:
        await message.answer(
            f"Сейчас enable_auto_publish={settings.enable_auto_publish}. "
            "Использование: /auto on|off"
        )
        return
    await message.answer(
        f"enable_auto_publish переключён в {settings.enable_auto_publish}."
    )


@router.message(Command("pause"))
async def cmd_pause(message: Message) -> None:
    if _scheduler is None:
        await message.answer("Scheduler выключен.")
        return
    _scheduler.pause()
    await message.answer("Scheduler поставлен на паузу.")


@router.message(Command("resume"))
async def cmd_resume(message: Message) -> None:
    if _scheduler is None:
        await message.answer("Scheduler выключен.")
        return
    _scheduler.resume()
    await message.answer("Scheduler возобновлён.")


# ---------------------------------------------------------------------------
# Site Radar - аудит сигналов
# ---------------------------------------------------------------------------

_SEVERITY_FILTERS: dict[str, tuple[str, ...]] = {
    "high": ("high",),
    "medium": ("medium",),
    "all": ("high", "medium", "low"),
}
_RADAR_SIGNALS_PAGE_SIZE = 5


def _format_signal_line(signal: SiteSignalListItem) -> str:
    return (
        f"• [{signal.severity}/{signal.score}] {signal.signal_type}/{signal.change_type}\n"
        f"  {signal.page_url}\n"
        f"  {signal.summary[:140]}\n"
        f"  status={signal.status}"
    )


async def _render_radar_signals_page(
    project_id: str,
    severity_key: str,
    page: int,
) -> tuple[str, InlineKeyboardMarkup | None]:
    severities = _SEVERITY_FILTERS.get(severity_key, _SEVERITY_FILTERS["high"])
    total = await count_signals_audit(_pool, project_id=project_id, severities=severities)
    if total == 0:
        text = f"Сигналов с фильтром `{severity_key}` нет."
        return text, None
    page = max(0, page)
    offset = page * _RADAR_SIGNALS_PAGE_SIZE
    if offset >= total:
        page = max(0, (total - 1) // _RADAR_SIGNALS_PAGE_SIZE)
        offset = page * _RADAR_SIGNALS_PAGE_SIZE
    signals = await list_signals_audit(
        _pool,
        project_id=project_id,
        severities=severities,
        limit=_RADAR_SIGNALS_PAGE_SIZE,
        offset=offset,
    )
    last_page = max(0, (total - 1) // _RADAR_SIGNALS_PAGE_SIZE)
    header = (
        f"<b>Site Radar - сигналы ({severity_key})</b>\n"
        f"страница {page + 1}/{last_page + 1} • всего {total}\n"
    )
    body = "\n\n".join(_format_signal_line(s) for s in signals)
    nav: list[InlineKeyboardButton] = []
    if page > 0:
        nav.append(
            InlineKeyboardButton(
                text="<<", callback_data=f"adm:rad:{severity_key}:{page - 1}"
            )
        )
    nav.append(
        InlineKeyboardButton(
            text=f"{page + 1}/{last_page + 1}", callback_data="adm:nop"
        )
    )
    if page < last_page:
        nav.append(
            InlineKeyboardButton(
                text=">>", callback_data=f"adm:rad:{severity_key}:{page + 1}"
            )
        )
    filters_row = [
        InlineKeyboardButton(
            text=("• high •" if severity_key == "high" else "high"),
            callback_data="adm:rad:high:0",
        ),
        InlineKeyboardButton(
            text=("• medium •" if severity_key == "medium" else "medium"),
            callback_data="adm:rad:medium:0",
        ),
        InlineKeyboardButton(
            text=("• all •" if severity_key == "all" else "all"),
            callback_data="adm:rad:all:0",
        ),
    ]
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[filters_row, nav, [_back_button()]]
    )
    return header + "\n" + body, keyboard


@router.message(Command("radar_signals"))
async def cmd_radar_signals(message: Message, command: CommandObject) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    project_id = await _ensure_project_id()
    args = (command.args or "").strip().split()
    severity_key = args[0].lower() if args else "high"
    if severity_key not in _SEVERITY_FILTERS:
        severity_key = "high"
    try:
        page = int(args[1]) - 1 if len(args) > 1 else 0
    except ValueError:
        page = 0
    text, keyboard = await _render_radar_signals_page(project_id, severity_key, page)
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")


# ---------------------------------------------------------------------------
# Quality queue
# ---------------------------------------------------------------------------


def _format_quality_item_line(item: ContentItemRecord, codes: str | None) -> str:
    short_topic = (item.topic[:80] + "…") if len(item.topic) > 80 else item.topic
    code_block = f"\n  коды: {codes}" if codes else ""
    return (
        f"• [{item.publish_date.strftime('%a %d.%m')}] [{item.post_type}] "
        f"{item.status}\n  {short_topic}\n  id={item.id}{code_block}"
    )


async def _render_quality_queue() -> tuple[str, InlineKeyboardMarkup | None]:
    project_id = await _ensure_project_id()
    items = await list_items_by_status(
        _pool,
        project_id=project_id,
        statuses=("quality_failed",),
        limit=20,
    )
    if not items:
        return (
            "Очередь quality_failed пуста — все посты прошли проверки.",
            InlineKeyboardMarkup(inline_keyboard=[[_back_button()]]),
        )
    lines = ["<b>Очередь quality_failed</b>"]
    rows: list[list[InlineKeyboardButton]] = []
    for item in items[:10]:
        codes = await latest_quality_codes(_pool, item.id)
        lines.append(_format_quality_item_line(item, codes))
        rows.append(
            [
                InlineKeyboardButton(
                    text=f"↻ {item.post_type} {item.publish_date.strftime('%d.%m')}",
                    callback_data=f"adm:qg:rg:{item.id}",
                ),
                InlineKeyboardButton(
                    text="text", callback_data=f"adm:qg:tx:{item.id}"
                ),
                InlineKeyboardButton(
                    text="skip", callback_data=f"adm:qg:sk:{item.id}"
                ),
            ]
        )
    rows.append([_back_button()])
    keyboard = InlineKeyboardMarkup(inline_keyboard=rows)
    return "\n\n".join(lines)[:3900], keyboard


@router.message(Command("quality_queue"))
async def cmd_quality_queue(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    text, keyboard = await _render_quality_queue()
    await message.answer(text, reply_markup=keyboard, parse_mode="HTML")


@router.message(Command("regenerate"))
async def cmd_regenerate(message: Message, command: CommandObject) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    item_id = (command.args or "").strip()
    if not item_id:
        await message.answer("Использование: /regenerate <content_item_id>")
        return
    await _trigger_regeneration(message.bot, item_id, message.chat.id)


async def _trigger_regeneration(bot: Bot, item_id: str, chat_id: int) -> None:
    settings = get_settings()
    project_id = await _ensure_project_id()
    item = await get_item(_pool, item_id)
    if item is None:
        await bot.send_message(chat_id, f"Item {item_id} не найден.")
        return
    if item.status not in {"quality_failed", "failed", "dedup_blocked"}:
        await bot.send_message(
            chat_id,
            f"Item {item_id[:8]} в статусе {item.status} — регенерация не нужна.",
        )
        return
    brand = await ensure_default_brand_profile(_pool, project_id)
    await reset_item_for_regeneration(_pool, item_id=item_id)
    refreshed = await get_item(_pool, item_id) or item
    deepseek = DeepSeekClient(settings)
    kie = KieClient(settings)
    await bot.send_message(chat_id, f"Запускаю перегенерацию {item_id[:8]}…")
    try:
        outcome = await prepare_item(
            _pool,
            project_id=project_id,
            item=refreshed,
            brand=brand,
            settings=settings,
            deepseek=deepseek,
            kie=kie,
        )
    except Exception as exc:
        logger.exception("regenerate_failed", extra={"item_id": item_id})
        await bot.send_message(chat_id, f"Регенерация упала: {exc}")
        return
    await bot.send_message(
        chat_id,
        f"Готово. status={outcome.status}\n"
        f"text_preview: {outcome.text_preview[:200]}",
    )


# ---------------------------------------------------------------------------
# /admin меню
# ---------------------------------------------------------------------------


def _back_button() -> InlineKeyboardButton:
    return InlineKeyboardButton(text="‹ В меню", callback_data="adm:menu")


def _admin_menu_markup() -> InlineKeyboardMarkup:
    settings = get_settings()
    auto_label = "🟢 Авто-публ." if settings.enable_auto_publish else "🔴 Авто-публ."
    dry_label = "🧪 dry_run ON" if settings.dry_run else "🧪 dry_run off"
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="📅 План недели", callback_data="adm:plan"),
                InlineKeyboardButton(
                    text="🛡 Очередь качества", callback_data="adm:quality"
                ),
            ],
            [
                InlineKeyboardButton(text="📡 Радар", callback_data="adm:rad:high:0"),
                InlineKeyboardButton(text="📊 Статус", callback_data="adm:status"),
            ],
            [
                InlineKeyboardButton(text=auto_label, callback_data="adm:auto"),
                InlineKeyboardButton(text=dry_label, callback_data="adm:dry"),
            ],
        ]
    )


def _admin_menu_text() -> str:
    settings = get_settings()
    return (
        "<b>Avaterra admin</b>\n"
        f"авто-публикация: {'on' if settings.enable_auto_publish else 'off'}\n"
        f"dry_run: {'on' if settings.dry_run else 'off'}\n"
        f"timezone: {settings.timezone}\n"
        "Выберите раздел:"
    )


@router.message(Command("admin"))
async def cmd_admin(message: Message) -> None:
    await message.answer(
        _admin_menu_text(), reply_markup=_admin_menu_markup(), parse_mode="HTML"
    )


async def _safe_edit(
    callback: CallbackQuery, text: str, keyboard: InlineKeyboardMarkup | None
) -> None:
    try:
        await callback.message.edit_text(
            text=text[:3900], reply_markup=keyboard, parse_mode="HTML"
        )
    except TelegramBadRequest:
        await callback.message.answer(text[:3900], reply_markup=keyboard, parse_mode="HTML")


@router.callback_query(lambda c: c.data == "adm:nop")
async def cb_nop(callback: CallbackQuery) -> None:
    await callback.answer()


@router.callback_query(lambda c: c.data == "adm:menu")
async def cb_menu(callback: CallbackQuery) -> None:
    await _safe_edit(callback, _admin_menu_text(), _admin_menu_markup())
    await callback.answer()


@router.callback_query(lambda c: c.data == "adm:status")
async def cb_status(callback: CallbackQuery) -> None:
    settings = get_settings()
    text = (
        "<b>Статус сервиса</b>\n"
        f"timezone: {settings.timezone}\n"
        f"scheduler: {'running' if _scheduler else 'off'}\n"
        f"db_pool: {'ready' if _pool else 'not ready'}\n"
        f"dry_run: {settings.dry_run}\n"
        f"enable_auto_publish: {settings.enable_auto_publish}\n"
        f"target_channel_id: {settings.target_channel_id or '-'}\n"
        f"posts_per_week: {settings.posts_per_week}"
    )
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[_back_button()]])
    await _safe_edit(callback, text, keyboard)
    await callback.answer()


@router.callback_query(lambda c: c.data == "adm:plan")
async def cb_plan(callback: CallbackQuery) -> None:
    project_id = await _ensure_project_id()
    monday, sunday = week_bounds(date.today())
    plan = await get_current_week_plan(
        _pool, project_id=project_id, week_start=monday
    )
    if plan is None:
        text = (
            f"План на {monday}-{sunday} ещё не построен.\n"
            "Запустите /plan_now или /plan."
        )
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[_back_button()]])
        await _safe_edit(callback, text, keyboard)
        await callback.answer()
        return
    items = await list_plan_items(_pool, plan.id)
    if not items:
        text = "В плане нет постов. Запустите /plan_now."
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[_back_button()]])
        await _safe_edit(callback, text, keyboard)
        await callback.answer()
        return
    lines = [f"<b>Контент-план {monday} — {sunday}</b>"]
    for item in items:
        short_topic = (
            (item.topic[:70] + "…") if len(item.topic) > 70 else item.topic
        )
        lines.append(
            f"• [{item.publish_date.strftime('%a %d.%m')}] "
            f"[{item.post_type}] {item.status}\n  {short_topic}\n  id={item.id}"
        )
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[_back_button()]])
    await _safe_edit(callback, "\n\n".join(lines), keyboard)
    await callback.answer()


@router.callback_query(lambda c: c.data == "adm:quality")
async def cb_quality(callback: CallbackQuery) -> None:
    text, keyboard = await _render_quality_queue()
    await _safe_edit(callback, text, keyboard)
    await callback.answer()


@router.callback_query(lambda c: (c.data or "").startswith("adm:rad:"))
async def cb_radar(callback: CallbackQuery) -> None:
    parts = (callback.data or "").split(":")
    if len(parts) != 4:
        await callback.answer()
        return
    severity_key = parts[2]
    try:
        page = int(parts[3])
    except ValueError:
        page = 0
    project_id = await _ensure_project_id()
    text, keyboard = await _render_radar_signals_page(project_id, severity_key, page)
    await _safe_edit(callback, text, keyboard)
    await callback.answer()


@router.callback_query(lambda c: (c.data or "").startswith("adm:qg:"))
async def cb_quality_action(callback: CallbackQuery) -> None:
    parts = (callback.data or "").split(":")
    if len(parts) != 4:
        await callback.answer()
        return
    action = parts[2]
    item_id = parts[3]
    if action == "rg":
        await callback.answer("Запускаю перегенерацию…")
        await _trigger_regeneration(
            callback.bot, item_id, callback.message.chat.id
        )
        text, keyboard = await _render_quality_queue()
        await _safe_edit(callback, text, keyboard)
    elif action == "tx":
        item = await get_item(_pool, item_id)
        if item is None:
            await callback.answer("Item не найден.", show_alert=True)
            return
        body = item.generated_text or "(текст ещё не сгенерирован)"
        codes = await latest_quality_codes(_pool, item_id)
        header = (
            f"<b>{item.post_type}</b> | {item.publish_date} | {item.status}\n"
            f"коды: {codes or '—'}\n\n"
        )
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="↻ Перегенерировать",
                        callback_data=f"adm:qg:rg:{item_id}",
                    ),
                    InlineKeyboardButton(
                        text="‹ К очереди", callback_data="adm:quality"
                    ),
                ]
            ]
        )
        await _safe_edit(callback, (header + body), keyboard)
        await callback.answer()
    elif action == "sk":
        await update_item_status(_pool, item_id=item_id, status="failed")
        await callback.answer("Помечено как failed (пропущено).")
        text, keyboard = await _render_quality_queue()
        await _safe_edit(callback, text, keyboard)
    else:
        await callback.answer()


@router.callback_query(lambda c: c.data == "adm:auto")
async def cb_auto_toggle(callback: CallbackQuery) -> None:
    settings = get_settings()
    settings.enable_auto_publish = not settings.enable_auto_publish
    await callback.answer(
        f"enable_auto_publish={settings.enable_auto_publish}"
    )
    await _safe_edit(callback, _admin_menu_text(), _admin_menu_markup())


@router.callback_query(lambda c: c.data == "adm:dry")
async def cb_dry_toggle(callback: CallbackQuery) -> None:
    settings = get_settings()
    settings.dry_run = not settings.dry_run
    await callback.answer(f"dry_run={settings.dry_run}")
    await _safe_edit(callback, _admin_menu_text(), _admin_menu_markup())
