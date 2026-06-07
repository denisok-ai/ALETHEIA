"""
@file: notifier.py
@description: Уведомления администратору о высокозначимых сигналах и сводках Site Radar
@dependencies: aiogram
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from aiogram import Bot
from aiogram.exceptions import TelegramAPIError

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.site_signals import SiteSignalRecord

logger = logging.getLogger(__name__)


def _format_signal(signal: SiteSignalRecord, summary: str) -> str:
    icon = {"high": "⚠️", "medium": "ℹ️", "low": "·"}.get(signal.severity, "·")
    text = (
        f"{icon} <b>Site Radar</b> [{signal.severity.upper()} {signal.score}]\n"
        f"<i>{signal.signal_type} / {signal.change_type}</i>\n"
        f"{summary or '-'}"
    )
    return text[:3500]


async def notify_admins(
    bot: Bot,
    settings: AppSettings,
    signals: Iterable[tuple[SiteSignalRecord, str]],
) -> int:
    """Разослать уведомления всем `ADMIN_TELEGRAM_IDS`. Возвращает кол-во успешных."""
    admin_ids = settings.admin_ids
    if not admin_ids:
        logger.info("admin_notify_skipped_no_admins")
        return 0

    sent = 0
    for signal, summary in signals:
        text = _format_signal(signal, summary)
        for admin_id in admin_ids:
            try:
                await bot.send_message(admin_id, text, parse_mode="HTML")
                sent += 1
            except TelegramAPIError:
                logger.exception(
                    "admin_notify_failed", extra={"admin_id": admin_id}
                )
    return sent
