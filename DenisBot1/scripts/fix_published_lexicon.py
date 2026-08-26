"""
@file: fix_published_lexicon.py
@description: Одноразовая правка лексики уже опубликованных постов в Telegram-канале
@dependencies: aiogram, asyncpg, services.quality.gates.normalize_post_lexicon
@created: 2026-05-13

Что делает:
- читает `content_items` со статусом `published` и непустым `tg_message_id`;
- прогоняет текст через `normalize_post_lexicon` (Avaterra -> Аватэрра, формы
  «калибр…» -> «замер через баланс тела» / «сверить ответ с балансом»);
- если текст изменился — вызывает `bot.edit_message_text` для первого
  текстового сообщения (того id, что мы сохранили в БД при публикации);
- обновляет в БД `final_text` (что фактически сейчас в канале);
- печатает построчный отчёт.

Что НЕ делает:
- не редактирует подпись фото (caption) и не пытается угадать id «второго чанка»
  для длинных постов — у нас в БД сохранён только первый message_id.
- не удаляет/перерисовывает изображения.
- не правит слово «метод» (без согласования падежей результат был бы корявым).
  Такие посты вычитываются и регенерируются отдельным процессом
  (`reset_item_for_regeneration` / админ-меню).

Запуск (в контейнере бота):

    docker compose exec bot python scripts/fix_published_lexicon.py             # dry-run
    docker compose exec bot python scripts/fix_published_lexicon.py --apply    # реальная правка

Можно ограничить число дней назад: --since-days 30 (по умолчанию 60).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.exceptions import TelegramAPIError

from avaterra_bot.config import get_settings
from avaterra_bot.services.quality.gates import normalize_post_lexicon


logger = logging.getLogger("fix_published_lexicon")


@dataclass
class PostRow:
    item_id: str
    tg_chat_id: int
    tg_message_id: int
    publish_date: str
    text: str
    text_field: str


async def _fetch_candidates(
    pool: asyncpg.Pool, since_days: int
) -> list[PostRow]:
    since = datetime.now(timezone.utc) - timedelta(days=since_days)
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id,
                   tg_chat_id,
                   tg_message_id,
                   publish_date,
                   final_text,
                   generated_text
            FROM content_items
            WHERE status = 'published'
              AND tg_message_id IS NOT NULL
              AND tg_chat_id IS NOT NULL
              AND (published_at IS NULL OR published_at >= $1)
            ORDER BY publish_date ASC
            """,
            since,
        )
    result: list[PostRow] = []
    for row in rows:
        final = (row["final_text"] or "").strip()
        if final:
            text, field = final, "final_text"
        else:
            text = (row["generated_text"] or "").strip()
            field = "generated_text"
        if not text:
            continue
        result.append(
            PostRow(
                item_id=row["id"],
                tg_chat_id=int(row["tg_chat_id"]),
                tg_message_id=int(row["tg_message_id"]),
                publish_date=row["publish_date"].isoformat(),
                text=text,
                text_field=field,
            )
        )
    return result


async def _update_final_text(
    pool: asyncpg.Pool, item_id: str, new_text: str
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
               SET final_text = $2,
                   updated_at = NOW()
             WHERE id = $1
            """,
            item_id,
            new_text,
        )


async def _edit_message(
    bot: Bot, chat_id: int, message_id: int, new_text: str
) -> Optional[str]:
    """Вернуть строковую ошибку или None при успехе."""
    try:
        await bot.edit_message_text(
            chat_id=chat_id,
            message_id=message_id,
            text=new_text,
        )
        return None
    except TelegramAPIError as exc:
        return str(exc)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="реально править канал")
    parser.add_argument("--since-days", type=int, default=60)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    settings = get_settings()
    pool = await asyncpg.create_pool(
        settings.database_url, min_size=1, max_size=4
    )
    bot = Bot(
        token=settings.bot_token.get_secret_value(),
        default=DefaultBotProperties(),
    )
    try:
        rows = await _fetch_candidates(pool, args.since_days)
        changed = 0
        skipped = 0
        manual: list[str] = []
        for row in rows:
            new_text = normalize_post_lexicon(row.text)
            if new_text == row.text:
                skipped += 1
                continue
            if len(new_text) > 4096:
                manual.append(
                    f"{row.item_id} {row.publish_date}: длина текста "
                    f"{len(new_text)} > 4096, нужна ручная правка (multi-chunk)"
                )
                continue
            print(
                f"[{row.publish_date}] {row.item_id} "
                f"chat={row.tg_chat_id} msg={row.tg_message_id} "
                f"text_field={row.text_field}: будет обновлён"
            )
            if not args.apply:
                continue
            error = await _edit_message(
                bot, row.tg_chat_id, row.tg_message_id, new_text
            )
            if error is not None:
                manual.append(
                    f"{row.item_id} {row.publish_date}: edit_message_text "
                    f"не сработал ({error})"
                )
                continue
            await _update_final_text(pool, row.item_id, new_text)
            changed += 1
        print(
            "\nИтог: "
            f"кандидатов={len(rows)}, изменено={changed}, без изменений={skipped}"
        )
        if manual:
            print("\nТребуют ручной правки в канале:")
            for line in manual:
                print(f"  - {line}")
    finally:
        await bot.session.close()
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
