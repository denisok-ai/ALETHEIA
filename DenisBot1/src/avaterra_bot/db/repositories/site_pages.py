"""
@file: site_pages.py
@description: Репозиторий site_pages и site_page_versions для Site Radar
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import asyncpg

from avaterra_bot.services.site_radar.normalizer import ContentBlock

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SitePageRecord:
    id: str
    project_id: str
    url: str
    category: str
    last_etag: Optional[str]
    last_modified_at: Optional[datetime]
    last_content_hash: Optional[bytes]


@dataclass(frozen=True)
class SitePageVersionRecord:
    id: str
    page_id: str
    fetched_at: datetime
    http_status: int
    content_hash: bytes
    blocks: list[ContentBlock]


async def upsert_page(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    url: str,
    category: str,
) -> SitePageRecord:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO site_pages (project_id, url, category, is_active, last_seen_at)
            VALUES ($1, $2, $3, TRUE, NOW())
            ON CONFLICT (project_id, url) DO UPDATE
                SET category = EXCLUDED.category,
                    is_active = TRUE,
                    last_seen_at = NOW()
            RETURNING id::text AS id, project_id::text AS project_id, url, category,
                      last_etag, last_modified_at, last_content_hash
            """,
            project_id,
            url,
            category,
        )
        return SitePageRecord(
            id=row["id"],
            project_id=row["project_id"],
            url=row["url"],
            category=row["category"],
            last_etag=row["last_etag"],
            last_modified_at=row["last_modified_at"],
            last_content_hash=bytes(row["last_content_hash"]) if row["last_content_hash"] else None,
        )


async def list_active_pages(pool: asyncpg.Pool, project_id: str) -> list[SitePageRecord]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id, project_id::text AS project_id, url, category,
                   last_etag, last_modified_at, last_content_hash
            FROM site_pages
            WHERE project_id = $1 AND is_active = TRUE
            """,
            project_id,
        )
        return [
            SitePageRecord(
                id=row["id"],
                project_id=row["project_id"],
                url=row["url"],
                category=row["category"],
                last_etag=row["last_etag"],
                last_modified_at=row["last_modified_at"],
                last_content_hash=bytes(row["last_content_hash"]) if row["last_content_hash"] else None,
            )
            for row in rows
        ]


async def deactivate_pages(pool: asyncpg.Pool, project_id: str, urls: list[str]) -> int:
    """Пометить URL как неактивные (исчезли из sitemap)."""
    if not urls:
        return 0
    async with pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE site_pages
            SET is_active = FALSE
            WHERE project_id = $1 AND url = ANY($2::text[])
            """,
            project_id,
            urls,
        )
    return int(result.split()[-1]) if result and result.split()[-1].isdigit() else 0


async def latest_version(
    pool: asyncpg.Pool, page_id: str
) -> Optional[SitePageVersionRecord]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id::text AS id, page_id::text AS page_id, fetched_at,
                   http_status, content_hash, blocks
            FROM site_page_versions
            WHERE page_id = $1
            ORDER BY fetched_at DESC
            LIMIT 1
            """,
            page_id,
        )
        if row is None:
            return None
        blocks_payload = row["blocks"]
        if isinstance(blocks_payload, str):
            blocks_payload = json.loads(blocks_payload)
        blocks = [ContentBlock.from_dict(b) for b in blocks_payload or []]
        return SitePageVersionRecord(
            id=row["id"],
            page_id=row["page_id"],
            fetched_at=row["fetched_at"],
            http_status=int(row["http_status"]),
            content_hash=bytes(row["content_hash"]),
            blocks=blocks,
        )


async def insert_version(
    pool: asyncpg.Pool,
    *,
    page_id: str,
    http_status: int,
    content_hash: bytes,
    cleaned_text: str,
    blocks: list[ContentBlock],
    meta: dict,
    etag: str | None,
    last_modified: str | None,
) -> SitePageVersionRecord:
    """Сохранить новую версию и обновить кеш-параметры страницы."""
    blocks_payload = [b.to_dict() for b in blocks]
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                INSERT INTO site_page_versions
                    (page_id, http_status, content_hash, cleaned_text, blocks, meta)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
                RETURNING id::text AS id, page_id::text AS page_id, fetched_at,
                          http_status, content_hash, blocks
                """,
                page_id,
                http_status,
                content_hash,
                cleaned_text,
                json.dumps(blocks_payload, ensure_ascii=False),
                json.dumps(meta, ensure_ascii=False),
            )
            last_modified_dt: Optional[datetime] = None
            if last_modified:
                try:
                    last_modified_dt = datetime.now(timezone.utc)
                except Exception:
                    last_modified_dt = None
            await conn.execute(
                """
                UPDATE site_pages
                SET last_status = $2,
                    last_etag = $3,
                    last_modified_at = COALESCE($4, last_modified_at),
                    last_content_hash = $5,
                    last_seen_at = NOW()
                WHERE id = $1
                """,
                page_id,
                http_status,
                etag,
                last_modified_dt,
                content_hash,
            )
        blocks_returned_payload = row["blocks"]
        if isinstance(blocks_returned_payload, str):
            blocks_returned_payload = json.loads(blocks_returned_payload)
        return SitePageVersionRecord(
            id=row["id"],
            page_id=row["page_id"],
            fetched_at=row["fetched_at"],
            http_status=int(row["http_status"]),
            content_hash=bytes(row["content_hash"]),
            blocks=[ContentBlock.from_dict(b) for b in blocks_returned_payload or []],
        )


async def touch_page_seen(pool: asyncpg.Pool, page_id: str, http_status: int) -> None:
    """Обновить last_seen_at без новой версии (например, когда вернулся 304)."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE site_pages
            SET last_seen_at = NOW(),
                last_status = $2
            WHERE id = $1
            """,
            page_id,
            http_status,
        )
