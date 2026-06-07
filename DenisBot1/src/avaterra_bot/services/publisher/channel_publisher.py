"""
@file: channel_publisher.py
@description: Публикация подготовленных постов в Telegram-канал с dry_run и идемпотентностью
@dependencies: aiogram, asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Optional

import asyncpg
from aiogram import Bot
from aiogram.exceptions import TelegramAPIError
from aiogram.types import FSInputFile

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    list_due_items,
    log_integration,
    update_item_published,
    update_item_status,
)
from avaterra_bot.db.repositories.theme_pool import mark_theme_status

logger = logging.getLogger(__name__)


@dataclass
class PublishOutcome:
    item_id: str
    status: str
    message_id: int | None
    dry_run: bool
    error: str | None = None


_TELEGRAM_MESSAGE_HARD_LIMIT = 4096
_MIN_PHOTO_TO_TEXT_DELAY_SECONDS = 10.0


def _split_text_for_telegram(text: str, limit: int = _TELEGRAM_MESSAGE_HARD_LIMIT) -> list[str]:
    """Разбить длинный текст на чанки, не разрывая абзацы. Telegram-лимит = 4096 символов.

    Если один абзац длиннее `limit`, режем по предложениям/символам, чтобы не уронить отправку.
    """
    text = (text or "").strip()
    if not text:
        return []
    if len(text) <= limit:
        return [text]

    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    buffer = ""
    for paragraph in paragraphs:
        candidate = f"{buffer}\n\n{paragraph}".strip() if buffer else paragraph
        if len(candidate) <= limit:
            buffer = candidate
            continue
        if buffer:
            chunks.append(buffer)
            buffer = ""
        if len(paragraph) <= limit:
            buffer = paragraph
        else:
            for start in range(0, len(paragraph), limit):
                piece = paragraph[start : start + limit]
                if len(piece) == limit:
                    chunks.append(piece)
                else:
                    buffer = piece
    if buffer:
        chunks.append(buffer)
    return chunks


def _resolve_photo_payload(item: ContentItemRecord):
    """Выбрать источник картинки: backup -> origin. file://... грузим как FSInputFile."""
    backup = (item.image_url_backup or "").strip()
    if backup:
        if backup.startswith("file://"):
            return FSInputFile(backup[len("file://") :])
        return backup
    origin = (item.image_url or "").strip()
    if not origin:
        return None
    return origin


def _effective_photo_to_text_delay(config_delay_seconds: float) -> float:
    """Никогда не публиковать текст раньше 10 секунд после фото."""
    try:
        raw = float(config_delay_seconds)
    except (TypeError, ValueError):
        raw = _MIN_PHOTO_TO_TEXT_DELAY_SECONDS
    return max(_MIN_PHOTO_TO_TEXT_DELAY_SECONDS, raw)


async def publish_item(
    bot: Bot,
    pool: asyncpg.Pool,
    *,
    project_id: str,
    settings: AppSettings,
    item: ContentItemRecord,
) -> PublishOutcome:
    """Опубликовать один пост. Учитывает dry_run и enable_auto_publish."""
    text = (item.final_text or item.generated_text or "").strip()
    if not text:
        await update_item_status(
            pool, item_id=item.id, status="failed", last_error="empty_text"
        )
        return PublishOutcome(
            item_id=item.id,
            status="failed",
            message_id=None,
            dry_run=settings.dry_run,
            error="empty_text",
        )
    request_id = uuid.uuid4().hex
    target_channel = settings.target_channel_id

    if settings.dry_run or not settings.enable_auto_publish or not target_channel:
        await update_item_status(
            pool,
            item_id=item.id,
            status="dry_run",
            last_error=None,
        )
        await log_integration(
            pool,
            project_id=project_id,
            provider="telegram",
            operation="channel.publish",
            request_id=request_id,
            status="dry_run",
            latency_ms=0,
            error_code=None,
            request_meta={
                "item_id": item.id,
                "post_type": item.post_type,
                "channel_id": target_channel,
            },
            response_meta={"reason": "dry_run_or_disabled"},
        )
        logger.info(
            "publisher_dry_run",
            extra={
                "item_id": item.id,
                "post_type": item.post_type,
                "publish_date": item.publish_date.isoformat(),
            },
        )
        return PublishOutcome(
            item_id=item.id,
            status="dry_run",
            message_id=None,
            dry_run=True,
        )

    try:
        chat_id = int(target_channel)
    except ValueError:
        await update_item_status(
            pool,
            item_id=item.id,
            status="failed",
            last_error=f"invalid_channel_id:{target_channel}",
        )
        return PublishOutcome(
            item_id=item.id,
            status="failed",
            message_id=None,
            dry_run=False,
            error="invalid_channel_id",
        )

    try:
        photo_payload = _resolve_photo_payload(item)
        photo_message_id: int | None = None
        if photo_payload is not None:
            photo_message = await bot.send_photo(
                chat_id=chat_id,
                photo=photo_payload,
                parse_mode=None,
            )
            photo_message_id = photo_message.message_id
            await asyncio.sleep(
                _effective_photo_to_text_delay(settings.publish_text_delay_seconds)
            )
        text_chunks = _split_text_for_telegram(text)
        text_message = None
        for idx, chunk in enumerate(text_chunks):
            sent = await bot.send_message(
                chat_id=chat_id,
                text=chunk,
                parse_mode=None,
            )
            if text_message is None:
                text_message = sent
            if idx < len(text_chunks) - 1:
                await asyncio.sleep(1.0)
        message = text_message if text_message is not None else photo_message
        published_at = datetime.now(timezone.utc)
        await update_item_published(
            pool,
            item_id=item.id,
            tg_chat_id=chat_id,
            tg_message_id=message.message_id,
            published_at=published_at,
        )
        if item.theme_id:
            await mark_theme_status(pool, item.theme_id, "used")
        await log_integration(
            pool,
            project_id=project_id,
            provider="telegram",
            operation="channel.publish",
            request_id=request_id,
            status="ok",
            latency_ms=0,
            error_code=None,
            request_meta={"item_id": item.id, "channel_id": chat_id},
            response_meta={
                "message_id": message.message_id,
                "photo_message_id": photo_message_id,
                "text_chunks": len(text_chunks),
            },
        )
        await _notify_admins_about_publish(
            bot,
            settings,
            item=item,
            chat_id=chat_id,
            message_id=message.message_id,
        )
        return PublishOutcome(
            item_id=item.id,
            status="published",
            message_id=message.message_id,
            dry_run=False,
        )
    except TelegramAPIError as exc:
        logger.exception("publisher_telegram_error", extra={"item_id": item.id})
        await update_item_status(
            pool, item_id=item.id, status="failed", last_error=str(exc)[:200]
        )
        await log_integration(
            pool,
            project_id=project_id,
            provider="telegram",
            operation="channel.publish",
            request_id=request_id,
            status="error",
            latency_ms=0,
            error_code=str(exc)[:200],
            request_meta={"item_id": item.id, "channel_id": chat_id},
            response_meta={},
        )
        return PublishOutcome(
            item_id=item.id,
            status="failed",
            message_id=None,
            dry_run=False,
            error=str(exc)[:200],
        )


async def _notify_admins_about_publish(
    bot: Bot,
    settings: AppSettings,
    *,
    item: ContentItemRecord,
    chat_id: int,
    message_id: int,
) -> None:
    """Сообщить администраторам, что пост опубликован, и подсказать /stat."""
    admin_ids = settings.admin_ids
    if not admin_ids:
        return
    short_topic = item.topic[:120]
    text = (
        "Опубликовано.\n"
        f"{item.publish_date} [{item.post_type}] msg_id={message_id}\n"
        f"Тема: {short_topic}\n\n"
        f"Через сутки пришлите статистику:\n"
        f"<code>/stat {item.id} ВЬЮСЫ РЕАКЦИИ</code>"
    )
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, text, disable_web_page_preview=True)
        except TelegramAPIError as exc:
            logger.warning(
                "publish_notify_failed",
                extra={"admin_id": admin_id, "error": str(exc)},
            )


async def publish_due_today(
    bot: Bot,
    pool: asyncpg.Pool,
    *,
    project_id: str,
    settings: AppSettings,
    today: Optional[date] = None,
) -> list[PublishOutcome]:
    """Опубликовать все готовые посты на сегодня."""
    today = today or date.today()
    items = await list_due_items(
        pool,
        project_id=project_id,
        publish_date=today,
        statuses=("approved", "ready"),
    )
    outcomes: list[PublishOutcome] = []
    for item in items:
        outcomes.append(
            await publish_item(
                bot,
                pool,
                project_id=project_id,
                settings=settings,
                item=item,
            )
        )
    return outcomes
