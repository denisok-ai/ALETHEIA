"""
@file: analytics.py
@description: Репозиторий статистики постов (post_statistics) и weekly-отчётов
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import asyncpg

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PostStatRecord:
    item_id: str
    publish_date: str
    post_type: str
    topic: str
    views: int
    reactions: int
    comments: int
    saves: int
    ctr: float
    collected_at: datetime


async def record_post_statistics(
    pool: asyncpg.Pool,
    *,
    content_item_id: str,
    views: int,
    reactions: int = 0,
    comments: int = 0,
    saves: int = 0,
    ctr: float = 0.0,
    source: str = "manual",
) -> str:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO post_statistics (
                content_item_id, views, reactions, ctr, comments, saves, source
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id::text AS id
            """,
            content_item_id,
            views,
            reactions,
            ctr,
            comments,
            saves,
            source,
        )
    return row["id"]


async def latest_post_stats(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    days: int = 7,
) -> list[PostStatRecord]:
    """Свежая статистика по опубликованным постам за N дней (последняя запись на пост)."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (ci.id)
                ci.id::text AS item_id,
                ci.publish_date,
                ci.post_type,
                ci.topic,
                COALESCE(ps.views, 0) AS views,
                COALESCE(ps.reactions, 0) AS reactions,
                COALESCE(ps.comments, 0) AS comments,
                COALESCE(ps.saves, 0) AS saves,
                COALESCE(ps.ctr, 0)::float AS ctr,
                COALESCE(ps.collected_at, ci.published_at, ci.created_at) AS collected_at
            FROM content_items ci
            JOIN content_plans cp ON cp.id = ci.plan_id
            LEFT JOIN post_statistics ps ON ps.content_item_id = ci.id
            WHERE cp.project_id = $1
              AND ci.status = 'published'
              AND ci.published_at IS NOT NULL
              AND ci.published_at >= NOW() - ($2 || ' days')::interval
            ORDER BY ci.id, ps.collected_at DESC NULLS LAST
            """,
            project_id,
            str(days),
        )
    return [
        PostStatRecord(
            item_id=row["item_id"],
            publish_date=row["publish_date"].isoformat(),
            post_type=row["post_type"],
            topic=row["topic"],
            views=int(row["views"]),
            reactions=int(row["reactions"]),
            comments=int(row["comments"]),
            saves=int(row["saves"]),
            ctr=float(row["ctr"]),
            collected_at=row["collected_at"],
        )
        for row in rows
    ]


async def weekly_summary(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    days: int = 7,
) -> dict[str, float | int]:
    """Сводка: количество постов, средние views/reactions/CTR по типам."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH last_stats AS (
                SELECT DISTINCT ON (ci.id)
                    ci.id, ci.post_type,
                    COALESCE(ps.views, 0) AS views,
                    COALESCE(ps.reactions, 0) AS reactions,
                    COALESCE(ps.ctr, 0)::float AS ctr
                FROM content_items ci
                JOIN content_plans cp ON cp.id = ci.plan_id
                LEFT JOIN post_statistics ps ON ps.content_item_id = ci.id
                WHERE cp.project_id = $1
                  AND ci.status = 'published'
                  AND ci.published_at >= NOW() - ($2 || ' days')::interval
                ORDER BY ci.id, ps.collected_at DESC NULLS LAST
            )
            SELECT
                COUNT(*) AS total_posts,
                COALESCE(SUM(views), 0) AS total_views,
                COALESCE(AVG(views), 0)::float AS avg_views,
                COALESCE(AVG(reactions), 0)::float AS avg_reactions,
                COALESCE(AVG(ctr), 0)::float AS avg_ctr,
                COALESCE(SUM(CASE WHEN post_type='info' THEN 1 ELSE 0 END), 0) AS info_count,
                COALESCE(SUM(CASE WHEN post_type='sales' THEN 1 ELSE 0 END), 0) AS sales_count,
                COALESCE(AVG(CASE WHEN post_type='info' THEN views END), 0)::float AS avg_views_info,
                COALESCE(AVG(CASE WHEN post_type='sales' THEN views END), 0)::float AS avg_views_sales
            FROM last_stats
            """,
            project_id,
            str(days),
        )
    row = rows[0] if rows else {}
    return {
        "total_posts": int(row.get("total_posts", 0)),
        "total_views": int(row.get("total_views", 0)),
        "avg_views": float(row.get("avg_views", 0)),
        "avg_reactions": float(row.get("avg_reactions", 0)),
        "avg_ctr": float(row.get("avg_ctr", 0)),
        "info_count": int(row.get("info_count", 0)),
        "sales_count": int(row.get("sales_count", 0)),
        "avg_views_info": float(row.get("avg_views_info", 0)),
        "avg_views_sales": float(row.get("avg_views_sales", 0)),
    }


async def get_published_item_brief(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item_id: str,
) -> Optional[dict]:
    """Короткая карточка опубликованного поста для UI/уведомлений."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT ci.id::text AS id, ci.publish_date, ci.post_type, ci.topic, ci.published_at
            FROM content_items ci
            JOIN content_plans cp ON cp.id = ci.plan_id
            WHERE cp.project_id = $1 AND ci.id = $2
            """,
            project_id,
            item_id,
        )
    if row is None:
        return None
    return {
        "id": row["id"],
        "publish_date": row["publish_date"].isoformat(),
        "post_type": row["post_type"],
        "topic": row["topic"],
        "published_at": row["published_at"],
    }
