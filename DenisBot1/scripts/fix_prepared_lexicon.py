"""
@file: fix_prepared_lexicon.py
@description: Привести подготовленные посты к новой лексике до публикации
@dependencies: asyncpg, services.quality.gates
@created: 2026-05-13

Идея:
- берём все `content_items` со статусами `ready`/`approved`/`text_ready`, у
  которых в тексте встречается «калибр…», «\bметод\b» или латинская Avaterra;
- сначала пытаемся починить детерминированно через `normalize_post_lexicon`
  (только Avaterra и формы «калибр…», без «метод»);
- если после нормализации все гейты проходят — обновляем `final_text`, статус
  оставляем как был;
- если остаётся «\bметод\b» или другие нарушения — сбрасываем элемент в
  `draft` через `reset_item_for_regeneration`, чтобы недельный пайплайн или
  админ-меню перегенерировали корректный текст и картинку.

Запуск (в контейнере бота):

    docker compose exec bot python scripts/fix_prepared_lexicon.py             # dry-run
    docker compose exec bot python scripts/fix_prepared_lexicon.py --apply    # реально

Можно ограничить только конкретный проект через --project-id <uuid>.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Optional

import asyncpg

from avaterra_bot.config import get_settings
from avaterra_bot.db.repositories.brand import get_brand_profile, BrandProfile
from avaterra_bot.db.repositories.content import (
    reset_item_for_regeneration,
    update_item_status,
)
from avaterra_bot.services.quality.gates import (
    evaluate_text,
    normalize_post_lexicon,
)


logger = logging.getLogger("fix_prepared_lexicon")


VIOLATION_PATTERNS = (
    re.compile(r"\bметод\b", re.IGNORECASE),
    re.compile(r"калибр", re.IGNORECASE),
    re.compile(r"\b[Aa]vaterra\b"),
    re.compile(r"\bAVATERRA\b"),
)

TARGET_STATUSES = ("ready", "approved", "text_ready")


@dataclass
class ItemRow:
    item_id: str
    project_id: str
    post_type: str
    topic: str
    status: str
    publish_date: str
    text: str
    text_field: str


def _has_violation(text: str) -> bool:
    return any(p.search(text) for p in VIOLATION_PATTERNS)


async def _fetch_items(
    pool: asyncpg.Pool, project_id: Optional[str]
) -> list[ItemRow]:
    where = "WHERE ci.status = ANY($1)"
    params: list[object] = [list(TARGET_STATUSES)]
    if project_id:
        where += " AND cp.project_id = $2"
        params.append(project_id)
    sql = f"""
        SELECT ci.id::text AS id,
               cp.project_id::text AS project_id,
               ci.post_type,
               ci.topic,
               ci.status,
               ci.publish_date,
               ci.final_text,
               ci.generated_text
        FROM content_items ci
        JOIN content_plans cp ON cp.id = ci.plan_id
        {where}
        ORDER BY ci.publish_date ASC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *params)
    out: list[ItemRow] = []
    for row in rows:
        final = (row["final_text"] or "").strip()
        if final:
            text, field = final, "final_text"
        else:
            text = (row["generated_text"] or "").strip()
            field = "generated_text"
        if not text or not _has_violation(text):
            continue
        out.append(
            ItemRow(
                item_id=row["id"],
                project_id=row["project_id"],
                post_type=row["post_type"],
                topic=row["topic"] or "",
                status=row["status"],
                publish_date=row["publish_date"].isoformat(),
                text=text,
                text_field=field,
            )
        )
    return out


async def _apply_final_text(
    pool: asyncpg.Pool, item_id: str, text: str
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
            text,
        )


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--project-id", default=None)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    settings = get_settings()
    pool = await asyncpg.create_pool(
        settings.database_url, min_size=1, max_size=4
    )
    try:
        rows = await _fetch_items(pool, args.project_id)
        if not rows:
            print("Нет подготовленных постов с нарушениями.")
            return
        brand_cache: dict[str, BrandProfile] = {}
        normalized = 0
        regenerated = 0
        for row in rows:
            new_text = normalize_post_lexicon(row.text)
            brand = brand_cache.get(row.project_id)
            if brand is None:
                brand = await get_brand_profile(pool, row.project_id) or BrandProfile(
                    project_id=row.project_id
                )
                brand_cache[row.project_id] = brand
            report = evaluate_text(
                text=new_text,
                topic=row.topic,
                post_type=row.post_type,
                brand=brand,
            )
            if report.passed and not _has_violation(new_text):
                print(
                    f"[{row.publish_date}] {row.item_id} {row.status} "
                    f"{row.post_type}: нормализация — OK"
                )
                if args.apply:
                    await _apply_final_text(pool, row.item_id, new_text)
                normalized += 1
                continue
            print(
                f"[{row.publish_date}] {row.item_id} {row.status} "
                f"{row.post_type}: нужна полная перегенерация "
                f"(коды: {','.join(report.codes) or '-'})"
            )
            if args.apply:
                await update_item_status(
                    pool,
                    item_id=row.item_id,
                    status="quality_failed",
                    last_error="lexicon_violation: " + ",".join(report.codes),
                )
                await reset_item_for_regeneration(pool, item_id=row.item_id)
            regenerated += 1
        print(
            "\nИтог: "
            f"кандидатов={len(rows)}, нормализовано={normalized}, "
            f"на перегенерацию={regenerated}"
        )
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
