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
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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
from avaterra_bot.services.quality.gates import (
    normalize_post_lexicon,
    scan_publish_blockers,
)

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


def _dry_run_reasons(settings: AppSettings) -> list[str]:
    """Перечислить, почему публикатор уйдёт в dry-run путь.

    Важно для диагностики: после инцидента 15–17.05.2026 in-memory toggle
    `settings.dry_run` молча отправлял посты в dry_run, а в логах был виден
    лишь общий `dry_run_or_disabled`. Теперь причина всегда явная.
    """
    reasons: list[str] = []
    if settings.dry_run:
        reasons.append("dry_run_flag")
    if not settings.enable_auto_publish:
        reasons.append("auto_publish_disabled")
    if not (settings.target_channel_id or "").strip():
        reasons.append("no_channel")
    return reasons


def today_in_timezone(tz_name: str) -> date:
    """Текущая дата в `tz_name`. Cron и публикатор должны видеть одно и то же «сегодня»."""
    try:
        tz = ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        return date.today()
    return datetime.now(tz).date()


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
    raw_text = (item.final_text or item.generated_text or "").strip()
    text = normalize_post_lexicon(raw_text)
    if text != raw_text:
        logger.info(
            "publisher_lexicon_normalized",
            extra={
                "item_id": item.id,
                "post_type": item.post_type,
                "changed_chars": abs(len(text) - len(raw_text)),
            },
        )
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
    blockers = scan_publish_blockers(text)
    if blockers:
        codes = sorted({issue.code for issue in blockers})
        marker = "publisher_blocked:" + ",".join(codes)
        await update_item_status(
            pool,
            item_id=item.id,
            status="quality_failed",
            last_error=marker[:200],
        )
        logger.error(
            "publisher_blocked_by_red_gate",
            extra={
                "item_id": item.id,
                "post_type": item.post_type,
                "publish_date": item.publish_date.isoformat(),
                "issues": codes,
            },
        )
        await log_integration(
            pool,
            project_id=project_id,
            provider="telegram",
            operation="channel.publish",
            request_id=uuid.uuid4().hex,
            status="blocked",
            latency_ms=0,
            error_code=marker[:200],
            request_meta={
                "item_id": item.id,
                "post_type": item.post_type,
                "channel_id": settings.target_channel_id,
            },
            response_meta={"issues": codes},
        )
        return PublishOutcome(
            item_id=item.id,
            status="quality_failed",
            message_id=None,
            dry_run=False,
            error=marker[:200],
        )

    if settings.is_admin_preview_mode:
        slot_today = today_in_timezone(settings.timezone)
        if item.publish_date != slot_today:
            logger.error(
                "admin_preview_wrong_publish_date",
                extra={
                    "item_id": item.id,
                    "item_publish_date": item.publish_date.isoformat(),
                    "slot_today": slot_today.isoformat(),
                },
            )
            return PublishOutcome(
                item_id=item.id,
                status="skipped",
                message_id=None,
                dry_run=False,
                error="wrong_publish_date",
            )
        if item.status == "admin_preview_sent":
            logger.info(
                "admin_preview_already_sent",
                extra={
                    "item_id": item.id,
                    "publish_date": item.publish_date.isoformat(),
                },
            )
            return PublishOutcome(
                item_id=item.id,
                status="admin_preview_sent",
                message_id=None,
                dry_run=False,
            )
        return await _send_admin_preview(
            bot,
            pool,
            project_id=project_id,
            settings=settings,
            item=item,
            text=text,
        )

    request_id = uuid.uuid4().hex
    target_channel = settings.target_channel_id
    dry_run_reasons = _dry_run_reasons(settings)

    if dry_run_reasons:
        await update_item_status(
            pool,
            item_id=item.id,
            status="dry_run",
            last_error=None,
        )
        reason_joined = ",".join(dry_run_reasons)
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
            response_meta={"reason": reason_joined, "reasons": dry_run_reasons},
        )
        logger.warning(
            "publisher_dry_run",
            extra={
                "item_id": item.id,
                "post_type": item.post_type,
                "publish_date": item.publish_date.isoformat(),
                "reasons": dry_run_reasons,
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


def _format_admin_preview_message(item: ContentItemRecord, text: str) -> str:
    """Собрать текст предпросмотра для администраторов (без картинки)."""
    return (
        "Пост на проверку\n"
        f"Дата: {item.publish_date} | Тип: {item.post_type}\n"
        f"Тема: {item.topic}\n\n"
        f"{text}"
    )


async def _send_admin_preview(
    bot: Bot,
    pool: asyncpg.Pool,
    *,
    project_id: str,
    settings: AppSettings,
    item: ContentItemRecord,
    text: str,
) -> PublishOutcome:
    """Отправить текст поста администраторам в личку для ручной публикации."""
    admin_ids = settings.admin_preview_recipient_ids
    if not admin_ids:
        await update_item_status(
            pool, item_id=item.id, status="failed", last_error="no_admins"
        )
        return PublishOutcome(
            item_id=item.id,
            status="failed",
            message_id=None,
            dry_run=False,
            error="no_admins",
        )

    request_id = uuid.uuid4().hex
    body = _format_admin_preview_message(item, text)
    chunks = _split_text_for_telegram(body)
    if not chunks:
        await update_item_status(
            pool, item_id=item.id, status="failed", last_error="empty_preview"
        )
        return PublishOutcome(
            item_id=item.id,
            status="failed",
            message_id=None,
            dry_run=False,
            error="empty_preview",
        )

    delivered_to: list[int] = []
    first_message_id: int | None = None
    for admin_id in sorted(admin_ids):
        try:
            admin_first_id: int | None = None
            for idx, chunk in enumerate(chunks):
                sent = await bot.send_message(
                    chat_id=admin_id,
                    text=chunk,
                    parse_mode=None,
                )
                if admin_first_id is None:
                    admin_first_id = sent.message_id
                if idx < len(chunks) - 1:
                    await asyncio.sleep(1.0)
            delivered_to.append(admin_id)
            if first_message_id is None and admin_first_id is not None:
                first_message_id = admin_first_id
        except TelegramAPIError as exc:
            logger.warning(
                "admin_preview_notify_failed",
                extra={"admin_id": admin_id, "item_id": item.id, "error": str(exc)},
            )

    if not delivered_to:
        await update_item_status(
            pool,
            item_id=item.id,
            status="failed",
            last_error="admin_preview_all_failed",
        )
        await log_integration(
            pool,
            project_id=project_id,
            provider="telegram",
            operation="admin.preview",
            request_id=request_id,
            status="error",
            latency_ms=0,
            error_code="admin_preview_all_failed",
            request_meta={"item_id": item.id, "admin_ids": list(admin_ids)},
            response_meta={},
        )
        return PublishOutcome(
            item_id=item.id,
            status="failed",
            message_id=None,
            dry_run=False,
            error="admin_preview_all_failed",
        )

    published_at = datetime.now(timezone.utc)
    await update_item_status(
        pool,
        item_id=item.id,
        status="admin_preview_sent",
        published_at=published_at,
    )
    if item.theme_id:
        await mark_theme_status(pool, item.theme_id, "used")
    await log_integration(
        pool,
        project_id=project_id,
        provider="telegram",
        operation="admin.preview",
        request_id=request_id,
        status="ok",
        latency_ms=0,
        error_code=None,
        request_meta={
            "item_id": item.id,
            "post_type": item.post_type,
            "admin_ids": delivered_to,
        },
        response_meta={
            "message_id": first_message_id,
            "text_chunks": len(chunks),
            "delivered_count": len(delivered_to),
        },
    )
    failed_ids = sorted(admin_ids - set(delivered_to))
    logger.info(
        "admin_preview_sent",
        extra={
            "item_id": item.id,
            "post_type": item.post_type,
            "publish_date": item.publish_date.isoformat(),
            "delivered_to": delivered_to,
            "failed_admin_ids": failed_ids,
        },
    )
    return PublishOutcome(
        item_id=item.id,
        status="admin_preview_sent",
        message_id=first_message_id,
        dry_run=False,
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
    today = today or today_in_timezone(settings.timezone)
    items = await list_due_items(
        pool,
        project_id=project_id,
        publish_date=today,
        statuses=("approved", "ready"),
    )
    logger.info(
        "publisher_due_items",
        extra={
            "publish_date": today.isoformat(),
            "publish_mode": settings.publish_mode,
            "count": len(items),
            "item_ids": [i.id for i in items],
            "post_types": [i.post_type for i in items],
        },
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
