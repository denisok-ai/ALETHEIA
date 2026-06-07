"""
@file: leads.py
@description: Репозиторий воронок и лид-событий (lead_funnels, lead_events)
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Optional

import asyncpg

logger = logging.getLogger(__name__)

DEFAULT_FUNNEL_SLUG = "main"
DEFAULT_FUNNEL_NAME = "Основная воронка"


@dataclass(frozen=True)
class FunnelRecord:
    id: str
    project_id: str
    slug: str
    name: str
    status: str


@dataclass(frozen=True)
class LeadEventRecord:
    id: str
    funnel_id: str
    telegram_user_id: int
    step: str
    segment: Optional[str]
    payload: dict[str, Any]


async def ensure_default_funnel(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    slug: str = DEFAULT_FUNNEL_SLUG,
    name: str = DEFAULT_FUNNEL_NAME,
) -> FunnelRecord:
    """Найти или создать воронку по (project_id, slug)."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id::text AS id, project_id::text AS project_id, slug, name, status
            FROM lead_funnels
            WHERE project_id = $1 AND slug = $2
            """,
            project_id,
            slug,
        )
        if row is None:
            row = await conn.fetchrow(
                """
                INSERT INTO lead_funnels (project_id, slug, name, status)
                VALUES ($1, $2, $3, 'active')
                RETURNING id::text AS id, project_id::text AS project_id, slug, name, status
                """,
                project_id,
                slug,
                name,
            )
        if row is None:
            raise RuntimeError("failed to ensure default funnel")
        return FunnelRecord(**dict(row))


async def log_lead_event(
    pool: asyncpg.Pool,
    *,
    funnel_id: str,
    telegram_user_id: int,
    step: str,
    segment: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    source_item_id: Optional[str] = None,
) -> str:
    """Сохранить событие касания воронки."""
    payload_json = json.dumps(payload or {}, ensure_ascii=False)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO lead_events (
                funnel_id, telegram_user_id, step, segment, payload,
                username, first_name, source_item_id
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
            RETURNING id::text AS id
            """,
            funnel_id,
            telegram_user_id,
            step,
            segment,
            payload_json,
            username,
            first_name,
            source_item_id,
        )
    return row["id"]


async def fetch_recent_user_events(
    pool: asyncpg.Pool,
    *,
    funnel_id: str,
    telegram_user_id: int,
    limit: int = 10,
) -> list[LeadEventRecord]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id, funnel_id::text AS funnel_id, telegram_user_id,
                   step, segment, payload
            FROM lead_events
            WHERE funnel_id = $1 AND telegram_user_id = $2
            ORDER BY created_at DESC
            LIMIT $3
            """,
            funnel_id,
            telegram_user_id,
            limit,
        )
    out: list[LeadEventRecord] = []
    for row in rows:
        payload = row["payload"]
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                payload = {}
        out.append(
            LeadEventRecord(
                id=row["id"],
                funnel_id=row["funnel_id"],
                telegram_user_id=int(row["telegram_user_id"]),
                step=row["step"],
                segment=row["segment"],
                payload=payload or {},
            )
        )
    return out


async def funnel_segment_stats(
    pool: asyncpg.Pool,
    *,
    funnel_id: str,
    days: int = 7,
) -> dict[str, int]:
    """Сколько уникальных пользователей попало в каждый сегмент за N дней."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT segment, COUNT(DISTINCT telegram_user_id) AS users
            FROM lead_events
            WHERE funnel_id = $1
              AND created_at >= NOW() - ($2 || ' days')::interval
              AND segment IS NOT NULL
            GROUP BY segment
            ORDER BY users DESC
            """,
            funnel_id,
            str(days),
        )
    return {row["segment"]: int(row["users"]) for row in rows}


async def funnel_total_starts(
    pool: asyncpg.Pool,
    *,
    funnel_id: str,
    days: int = 7,
) -> int:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(DISTINCT telegram_user_id) AS users
            FROM lead_events
            WHERE funnel_id = $1
              AND step = 'start'
              AND created_at >= NOW() - ($2 || ' days')::interval
            """,
            funnel_id,
            str(days),
        )
    return int(row["users"]) if row else 0
