"""
@file: admin_acl.py
@description: Middleware ограничения админ-команд по списку Telegram ID
@dependencies: aiogram
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import CallbackQuery, Message, TelegramObject

from avaterra_bot.config import get_settings

logger = logging.getLogger(__name__)


class AdminOnlyMiddleware(BaseMiddleware):
    """Пропускает события только от перечисленных в ENV администраторов."""

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        admin_ids = get_settings().admin_ids
        user = getattr(event, "from_user", None)
        if user is None or user.id not in admin_ids:
            logger.warning(
                "unauthorized_admin_event",
                extra={"telegram_user_id": getattr(user, "id", None)},
            )
            if isinstance(event, Message):
                await event.answer("Доступ ограничен.")
            elif isinstance(event, CallbackQuery):
                await event.answer("Доступ ограничен.", show_alert=True)
            return None
        return await handler(event, data)
