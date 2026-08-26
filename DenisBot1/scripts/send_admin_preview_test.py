"""
@file: send_admin_preview_test.py
@description: Разовая отправка предпросмотра поста всем админам (режим admin_preview)
@dependencies: channel_publisher, config, db
@created: 2026-05-20

Запуск в контейнере бота:

    docker compose exec bot python scripts/send_admin_preview_test.py
    docker compose exec bot python scripts/send_admin_preview_test.py --item-id <uuid>
    docker compose exec bot python scripts/send_admin_preview_test.py --reset-status
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties

from avaterra_bot.config import get_settings
from avaterra_bot.db.engine import close_pool, get_pool
from avaterra_bot.db.repositories.content import get_item
from avaterra_bot.services.publisher.channel_publisher import (
    publish_item,
    today_in_timezone,
)

logger = logging.getLogger("send_admin_preview_test")


async def _resolve_project_id(pool, item_id: str) -> str:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT cp.project_id::text AS project_id
            FROM content_plans cp
            JOIN content_items i ON i.plan_id = cp.id
            WHERE i.id = $1::uuid
            """,
            item_id,
        )
    if row is None:
        raise RuntimeError(f"plan not found for item {item_id}")
    return row["project_id"]


async def _pick_ready_item_id(pool, *, publish_date) -> str | None:
    """Только пост на указанную дату — не ближайший ready из будущего."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT i.id::text AS id
            FROM content_items i
            WHERE i.publish_date = $1
              AND i.status IN ('approved', 'ready')
              AND coalesce(trim(i.final_text), trim(i.generated_text), '') <> ''
            LIMIT 1
            """,
            publish_date,
        )
    return row["id"] if row else None


async def main() -> int:
    parser = argparse.ArgumentParser(description="Send admin preview test message")
    parser.add_argument("--item-id", help="content_items UUID")
    parser.add_argument(
        "--reset-status",
        action="store_true",
        help="After send, restore item status to ready (for scheduled posts)",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.is_admin_preview_mode:
        print(
            f"WARNING: PUBLISH_MODE={settings.publish_mode!r}, "
            "expected admin_preview",
            file=sys.stderr,
        )
    if not settings.admin_ids:
        print("ERROR: ADMIN_TELEGRAM_IDS is empty", file=sys.stderr)
        return 1

    pool = await get_pool()
    try:
        today = today_in_timezone(settings.timezone)
        item_id = args.item_id or await _pick_ready_item_id(pool, publish_date=today)
        if not item_id:
            print("ERROR: no ready/approved items with text", file=sys.stderr)
            return 1

        item = await get_item(pool, item_id)
        if item is None:
            print(f"ERROR: item not found: {item_id}", file=sys.stderr)
            return 1
        if not (item.final_text or item.generated_text or "").strip():
            print(f"ERROR: item {item.id} has empty text", file=sys.stderr)
            return 1

        project_id = await _resolve_project_id(pool, item.id)
        bot = Bot(
            token=settings.bot_token.get_secret_value(),
            default=DefaultBotProperties(),
        )
        try:
            outcome = await publish_item(
                bot,
                pool,
                project_id=project_id,
                settings=settings,
                item=item,
            )
        finally:
            await bot.session.close()

        print(
            f"item_id={outcome.item_id} status={outcome.status} "
            f"msg_id={outcome.message_id} error={outcome.error!r} "
            f"admins={sorted(settings.admin_ids)}"
        )

        if args.reset_status and outcome.status == "admin_preview_sent":
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE content_items
                    SET status = 'ready',
                        published_at = NULL,
                        updated_at = NOW()
                    WHERE id = $1::uuid
                    """,
                    item.id,
                )
            print(f"reset status to ready for {item.id}")

        return 0 if outcome.status == "admin_preview_sent" else 2
    finally:
        await close_pool()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(asyncio.run(main()))
