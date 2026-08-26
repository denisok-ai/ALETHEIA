"""
@file: weekly_notify.py
@description: Уведомления администраторам о результатах недельного пайплайна
@dependencies: aiogram, WeeklyOutcome
@created: 2026-05-12
"""

from __future__ import annotations

import logging
from typing import Optional

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from avaterra_bot.config import AppSettings
from avaterra_bot.services.planner.weekly_orchestrator import WeeklyOutcome

logger = logging.getLogger(__name__)


_MAX_PROBLEMS_IN_MESSAGE = 10


def _menu_keyboard() -> InlineKeyboardMarkup:
    """Быстрые действия из уведомления: меню админа и ручной перезапуск."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🧪 Очередь качества", callback_data="adm:quality"
                ),
                InlineKeyboardButton(
                    text="📅 План недели", callback_data="adm:plan"
                ),
            ],
            [
                InlineKeyboardButton(
                    text="🔁 Перезапустить генерацию",
                    callback_data="adm:genweek",
                ),
            ],
        ]
    )


def _format_success(outcome: WeeklyOutcome) -> str:
    return (
        "<b>✅ Контент на неделю готов</b>\n"
        f"{outcome.week_start:%d.%m} — {outcome.week_end:%d.%m}\n"
        f"Готово: <b>{outcome.ready_count}/{outcome.items_total}</b>, "
        f"проходов: {outcome.passes_run}.\n"
        f"<code>plan_id={outcome.plan_id}</code>"
    )


def _format_partial(outcome: WeeklyOutcome) -> str:
    lines = [
        "<b>⚠️ Контент на неделю собран частично</b>",
        f"{outcome.week_start:%d.%m} — {outcome.week_end:%d.%m}",
        (
            f"Готово: <b>{outcome.ready_count}/{outcome.items_total}</b>, "
            f"проходов: {outcome.passes_run}."
        ),
        f"<code>plan_id={outcome.plan_id}</code>",
        "",
        "<b>Требует внимания:</b>",
    ]
    for problem in outcome.problem_items[:_MAX_PROBLEMS_IN_MESSAGE]:
        reason = (problem.reason or "—")[:80]
        item_label = problem.item_id[:8] if problem.item_id else "—"
        lines.append(
            f"• {problem.publish_date:%a %d.%m} [{problem.post_type}] "
            f"{problem.status}: {reason} <code>{item_label}</code>"
        )
    leftover = len(outcome.problem_items) - _MAX_PROBLEMS_IN_MESSAGE
    if leftover > 0:
        lines.append(f"…и ещё {leftover}")
    lines.append("")
    lines.append(
        "Откройте меню /admin → Очередь качества или нажмите кнопку ниже, "
        "чтобы перезапустить генерацию."
    )
    return "\n".join(lines)


def format_outcome(outcome: WeeklyOutcome) -> str:
    """Текст уведомления для админа (HTML)."""
    text = _format_success(outcome) if outcome.all_ready else _format_partial(outcome)
    return text[:3800]


def format_failure(error: BaseException, *, target_monday: Optional[str] = None) -> str:
    """Текст уведомления о критическом сбое до завершения пайплайна."""
    header = "<b>🛑 Сбой недельного пайплайна</b>"
    reason = f"{type(error).__name__}: {str(error)[:300]}"
    target = f"\nЦелевая неделя: {target_monday}" if target_monday else ""
    return (
        f"{header}{target}\n"
        f"<code>{reason}</code>\n\n"
        "Запустите вручную из меню /admin → Перезапустить генерацию, "
        "когда причина устранена."
    )


async def notify_admins(
    bot: Bot,
    settings: AppSettings,
    *,
    text: str,
    with_actions: bool = True,
) -> int:
    """Отправить текст всем `ADMIN_TELEGRAM_IDS`. Возвращает количество успешных."""
    admin_ids = settings.admin_ids
    if not admin_ids:
        logger.info("weekly_notify_skipped_no_admins")
        return 0
    keyboard = _menu_keyboard() if with_actions else None
    sent = 0
    for admin_id in admin_ids:
        try:
            await bot.send_message(
                admin_id,
                text,
                parse_mode="HTML",
                reply_markup=keyboard,
                disable_web_page_preview=True,
            )
            sent += 1
        except TelegramAPIError:
            logger.exception(
                "weekly_notify_failed", extra={"admin_id": admin_id}
            )
    return sent


async def notify_weekly_pipeline_result(
    bot: Bot,
    settings: AppSettings,
    outcome: WeeklyOutcome,
) -> int:
    """Уведомить администраторов о результате `run_weekly_pipeline`."""
    if not settings.weekly_pipeline_notify_admins:
        return 0
    return await notify_admins(
        bot, settings, text=format_outcome(outcome), with_actions=True
    )


async def notify_weekly_pipeline_failure(
    bot: Bot,
    settings: AppSettings,
    error: BaseException,
    *,
    target_monday: Optional[str] = None,
) -> int:
    """Уведомить о критическом сбое, не дошедшем до сверки плана."""
    if not settings.weekly_pipeline_notify_admins:
        return 0
    return await notify_admins(
        bot,
        settings,
        text=format_failure(error, target_monday=target_monday),
        with_actions=True,
    )
