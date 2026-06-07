"""
@file: theme_pool.py
@description: Выборка идей из theme_pool для контент-планировщика
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional

import asyncpg


@dataclass
class ThemeRecord:
    id: str
    project_id: str
    topic: str
    angle: Optional[str]
    post_type: str
    priority: int
    status: str
    payload: dict = field(default_factory=dict)
    source: str = "manual"
    audience: Optional[str] = None
    rubric: Optional[str] = None


async def fetch_pending_themes(
    pool: asyncpg.Pool,
    project_id: str,
    *,
    post_type: Optional[str] = None,
    rubric: Optional[str] = None,
    audience: Optional[str] = None,
    limit: int = 5,
) -> list[ThemeRecord]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id, project_id::text AS project_id, topic, angle,
                   post_type, priority, status, payload,
                   source, audience, rubric
            FROM theme_pool
            WHERE project_id = $1
              AND status = 'pending'
              AND ($2::text IS NULL OR post_type = $2)
              AND ($3::text IS NULL OR rubric = $3)
              AND ($4::text IS NULL OR audience = $4)
              AND (not_before IS NULL OR not_before <= CURRENT_DATE)
              AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
            ORDER BY priority DESC, created_at ASC
            LIMIT $5
            """,
            project_id,
            post_type,
            rubric,
            audience,
            limit,
        )
        return [_row_to_theme(row) for row in rows]


async def mark_theme_status(
    pool: asyncpg.Pool, theme_id: str, status: str
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE theme_pool
            SET status = $2, updated_at = NOW()
            WHERE id = $1
            """,
            theme_id,
            status,
        )


def _row_to_theme(row) -> ThemeRecord:
    payload = row["payload"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    return ThemeRecord(
        id=row["id"],
        project_id=row["project_id"],
        topic=row["topic"],
        angle=row["angle"],
        post_type=row["post_type"],
        priority=int(row["priority"]),
        status=row["status"],
        payload=dict(payload or {}),
        source=row["source"] or "manual",
        audience=row["audience"],
        rubric=row["rubric"],
    )
