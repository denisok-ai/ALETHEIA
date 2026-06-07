"""
@file: site_signals.py
@description: Репозиторий site_signals и theme_pool
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Optional

import asyncpg

from avaterra_bot.services.site_radar.scorer import ScoredSignal

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SiteSignalRecord:
    id: str
    project_id: str
    page_id: str
    signal_type: str
    change_type: str
    severity: str
    score: int
    summary: str


@dataclass(frozen=True)
class SiteSignalListItem:
    """Элемент аудита сигналов (для команды /radar_signals)."""

    id: str
    page_url: str
    category: str
    signal_type: str
    change_type: str
    severity: str
    score: int
    summary: str
    status: str
    created_at_iso: str


async def save_signal(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    page_id: str,
    version_id: Optional[str],
    signal: ScoredSignal,
) -> SiteSignalRecord:
    payload = dict(signal.payload)
    payload["summary"] = signal.summary
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO site_signals
                (project_id, page_id, version_id, signal_type, change_type,
                 severity, score, payload, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'new')
            RETURNING id::text AS id, project_id::text AS project_id,
                      page_id::text AS page_id, signal_type, change_type,
                      severity, score
            """,
            project_id,
            page_id,
            version_id,
            signal.signal_type,
            signal.change_type,
            signal.severity,
            signal.score,
            json.dumps(payload, ensure_ascii=False),
        )
        return SiteSignalRecord(
            id=row["id"],
            project_id=row["project_id"],
            page_id=row["page_id"],
            signal_type=row["signal_type"],
            change_type=row["change_type"],
            severity=row["severity"],
            score=int(row["score"]),
            summary=signal.summary,
        )


async def mark_signal_status(
    pool: asyncpg.Pool, signal_id: str, status: str
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE site_signals
            SET status = $2, processed_at = NOW()
            WHERE id = $1
            """,
            signal_id,
            status,
        )


async def insert_theme(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    topic: str,
    angle: str | None,
    post_type: str,
    priority: int,
    source_signal_id: str | None,
    payload: dict,
    source: str = "radar",
    audience: str | None = None,
    rubric: str | None = None,
) -> str:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO theme_pool
                (project_id, topic, angle, post_type, priority,
                 source_signal_id, payload, status, source, audience, rubric)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'pending', $8, $9, $10)
            RETURNING id::text
            """,
            project_id,
            topic,
            angle,
            post_type,
            priority,
            source_signal_id,
            json.dumps(payload, ensure_ascii=False),
            source,
            audience,
            rubric,
        )
        return row["id"]


async def list_signals_audit(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    severities: tuple[str, ...] = ("high", "medium"),
    limit: int = 10,
    offset: int = 0,
) -> list[SiteSignalListItem]:
    """Список сигналов для аудита админом, отсортированных по убыванию score/времени."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT s.id::text AS id,
                   p.url AS page_url,
                   p.category AS category,
                   s.signal_type AS signal_type,
                   s.change_type AS change_type,
                   s.severity AS severity,
                   s.score AS score,
                   COALESCE(s.payload->>'summary', '') AS summary,
                   s.status AS status,
                   s.created_at AS created_at
            FROM site_signals s
            JOIN site_pages p ON p.id = s.page_id
            WHERE s.project_id = $1
              AND s.severity = ANY($2::text[])
            ORDER BY s.score DESC, s.created_at DESC
            LIMIT $3 OFFSET $4
            """,
            project_id,
            list(severities),
            limit,
            offset,
        )
        return [
            SiteSignalListItem(
                id=row["id"],
                page_url=row["page_url"],
                category=row["category"],
                signal_type=row["signal_type"],
                change_type=row["change_type"],
                severity=row["severity"],
                score=int(row["score"]),
                summary=(row["summary"] or "")[:200],
                status=row["status"],
                created_at_iso=row["created_at"].isoformat(),
            )
            for row in rows
        ]


async def count_signals_audit(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    severities: tuple[str, ...] = ("high", "medium"),
) -> int:
    """Кол-во сигналов для аудита."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT COUNT(*) AS cnt
            FROM site_signals
            WHERE project_id = $1
              AND severity = ANY($2::text[])
            """,
            project_id,
            list(severities),
        )
        return int(row["cnt"])


async def recent_theme_topics(
    pool: asyncpg.Pool, project_id: str, days: int = 90
) -> list[str]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT topic
            FROM theme_pool
            WHERE project_id = $1
              AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
            """,
            project_id,
            days,
        )
        return [row["topic"] for row in rows]
