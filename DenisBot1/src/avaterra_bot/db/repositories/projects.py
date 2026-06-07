"""
@file: projects.py
@description: Репозиторий проектов и онбординг параметров
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ProjectRecord:
    """Минимальная карточка проекта."""

    id: str
    name: str
    website_url: str
    channel_id: int
    timezone: str


async def ensure_default_project(
    pool: asyncpg.Pool,
    *,
    name: str,
    website_url: str,
    channel_id: int,
    timezone: str,
) -> ProjectRecord:
    """Найти или создать проект по `website_url` (используется на старте бота)."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id::text AS id, name, website_url, channel_id, timezone
            FROM projects
            WHERE website_url = $1
            ORDER BY created_at ASC
            LIMIT 1
            """,
            website_url,
        )
        if row is None:
            row = await conn.fetchrow(
                """
                INSERT INTO projects (name, website_url, channel_id, timezone)
                VALUES ($1, $2, $3, $4)
                RETURNING id::text AS id, name, website_url, channel_id, timezone
                """,
                name,
                website_url,
                channel_id,
                timezone,
            )
        if row is None:
            raise RuntimeError("failed to ensure default project")
        return ProjectRecord(
            id=row["id"],
            name=row["name"],
            website_url=row["website_url"],
            channel_id=int(row["channel_id"]),
            timezone=row["timezone"],
        )
