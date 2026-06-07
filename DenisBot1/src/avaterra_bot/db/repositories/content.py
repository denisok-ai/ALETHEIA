"""
@file: content.py
@description: Репозитории content_plans, content_items, prompts, integration_logs
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

import asyncpg


@dataclass
class ContentPlanRecord:
    id: str
    project_id: str
    week_start: date
    week_end: date
    status: str


@dataclass
class ContentItemRecord:
    id: str
    plan_id: str
    publish_date: date
    post_type: str
    topic: str
    objective: str
    outline: Optional[str]
    cta: Optional[str]
    status: str
    generated_text: Optional[str]
    final_text: Optional[str]
    image_url: Optional[str]
    image_prompt: Optional[str]
    image_task_id: Optional[str]
    theme_id: Optional[str]
    dedup_status: Optional[str]
    dedup_reason: Optional[str]
    retry_count: int
    last_error: Optional[str]
    approved_by: Optional[int]
    published_at: Optional[datetime]
    image_url_backup: Optional[str] = None
    image_backup_status: Optional[str] = None


async def upsert_plan(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    week_start: date,
    week_end: date,
) -> ContentPlanRecord:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO content_plans (project_id, week_start, week_end, status)
            VALUES ($1, $2, $3, 'draft')
            ON CONFLICT (project_id, week_start) DO UPDATE
                SET week_end = EXCLUDED.week_end,
                    status = CASE
                        WHEN content_plans.status IN ('draft', 'ready') THEN content_plans.status
                        ELSE 'draft'
                    END
            RETURNING id::text AS id, project_id::text AS project_id,
                      week_start, week_end, status
            """,
            project_id,
            week_start,
            week_end,
        )
        return ContentPlanRecord(
            id=row["id"],
            project_id=row["project_id"],
            week_start=row["week_start"],
            week_end=row["week_end"],
            status=row["status"],
        )


async def upsert_item(
    pool: asyncpg.Pool,
    *,
    plan_id: str,
    publish_date: date,
    post_type: str,
    topic: str,
    objective: str,
    outline: str | None,
    cta: str | None,
    theme_id: str | None,
) -> ContentItemRecord:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO content_items
                (plan_id, publish_date, post_type, topic, objective, outline, cta,
                 status, theme_id, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, NOW())
            ON CONFLICT (plan_id, publish_date, post_type) DO UPDATE
                SET topic = EXCLUDED.topic,
                    objective = EXCLUDED.objective,
                    outline = EXCLUDED.outline,
                    cta = EXCLUDED.cta,
                    theme_id = COALESCE(content_items.theme_id, EXCLUDED.theme_id),
                    updated_at = NOW()
            RETURNING id::text AS id, plan_id::text AS plan_id, publish_date,
                      post_type, topic, objective, outline, cta, status,
                      generated_text, final_text, image_url, image_prompt,
                      image_task_id, theme_id::text AS theme_id, dedup_status,
                      dedup_reason, retry_count, last_error, approved_by,
                      published_at, image_url_backup, image_backup_status
            """,
            plan_id,
            publish_date,
            post_type,
            topic,
            objective,
            outline,
            cta,
            theme_id,
        )
        return _row_to_item(row)


async def list_plan_items(
    pool: asyncpg.Pool, plan_id: str
) -> list[ContentItemRecord]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text AS id, plan_id::text AS plan_id, publish_date,
                   post_type, topic, objective, outline, cta, status,
                   generated_text, final_text, image_url, image_prompt,
                   image_task_id, theme_id::text AS theme_id, dedup_status,
                   dedup_reason, retry_count, last_error, approved_by,
                   published_at, image_url_backup, image_backup_status
            FROM content_items
            WHERE plan_id = $1
            ORDER BY publish_date ASC, post_type ASC
            """,
            plan_id,
        )
        return [_row_to_item(row) for row in rows]


async def list_due_items(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    publish_date: date,
    statuses: tuple[str, ...] = ("approved", "ready"),
) -> list[ContentItemRecord]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT i.id::text AS id, i.plan_id::text AS plan_id, i.publish_date,
                   i.post_type, i.topic, i.objective, i.outline, i.cta, i.status,
                   i.generated_text, i.final_text, i.image_url, i.image_prompt,
                   i.image_task_id, i.theme_id::text AS theme_id, i.dedup_status,
                   i.dedup_reason, i.retry_count, i.last_error, i.approved_by,
                   i.published_at, i.image_url_backup, i.image_backup_status
            FROM content_items i
            JOIN content_plans p ON p.id = i.plan_id
            WHERE p.project_id = $1
              AND i.publish_date = $2
              AND i.status = ANY($3::text[])
            ORDER BY i.post_type ASC
            """,
            project_id,
            publish_date,
            list(statuses),
        )
        return [_row_to_item(row) for row in rows]


async def update_item_text(
    pool: asyncpg.Pool,
    *,
    item_id: str,
    generated_text: str,
    final_text: Optional[str],
    status: str,
    dedup_status: Optional[str] = None,
    dedup_reason: Optional[str] = None,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
            SET generated_text = $2,
                final_text = COALESCE($3, final_text),
                status = $4,
                dedup_status = COALESCE($5, dedup_status),
                dedup_reason = COALESCE($6, dedup_reason),
                updated_at = NOW()
            WHERE id = $1
            """,
            item_id,
            generated_text,
            final_text,
            status,
            dedup_status,
            dedup_reason,
        )


async def update_item_image(
    pool: asyncpg.Pool,
    *,
    item_id: str,
    image_url: str,
    image_prompt: str,
    image_task_id: Optional[str],
    status: str,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
            SET image_url = $2,
                image_prompt = $3,
                image_task_id = $4,
                status = $5,
                updated_at = NOW()
            WHERE id = $1
            """,
            item_id,
            image_url,
            image_prompt,
            image_task_id,
            status,
        )


async def update_item_status(
    pool: asyncpg.Pool,
    *,
    item_id: str,
    status: str,
    last_error: Optional[str] = None,
    approved_by: Optional[int] = None,
    published_at: Optional[datetime] = None,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
            SET status = $2,
                last_error = COALESCE($3, last_error),
                approved_by = COALESCE($4, approved_by),
                published_at = COALESCE($5, published_at),
                updated_at = NOW(),
                retry_count = CASE WHEN $2 = 'failed'
                                   THEN retry_count + 1
                                   ELSE retry_count END
            WHERE id = $1
            """,
            item_id,
            status,
            last_error,
            approved_by,
            published_at,
        )


async def reset_item_for_regeneration(
    pool: asyncpg.Pool, *, item_id: str
) -> None:
    """Сбросить item в `draft` для перегенерации после quality_failed/публикации."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
            SET status = 'draft',
                generated_text = NULL,
                final_text = NULL,
                image_url = NULL,
                image_prompt = NULL,
                image_task_id = NULL,
                image_url_backup = NULL,
                image_backup_status = 'pending',
                dedup_status = 'pending',
                dedup_reason = NULL,
                last_error = NULL,
                retry_count = 0,
                approved_by = NULL,
                published_at = NULL,
                tg_chat_id = NULL,
                tg_message_id = NULL,
                updated_at = NOW()
            WHERE id = $1
            """,
            item_id,
        )


async def update_item_published(
    pool: asyncpg.Pool,
    *,
    item_id: str,
    tg_chat_id: int,
    tg_message_id: int,
    published_at: datetime,
) -> None:
    """Сохранить ID опубликованного сообщения для последующей сверки статистики."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
            SET status = 'published',
                tg_chat_id = $2,
                tg_message_id = $3,
                published_at = COALESCE(published_at, $4),
                updated_at = NOW()
            WHERE id = $1
            """,
            item_id,
            tg_chat_id,
            tg_message_id,
            published_at,
        )


async def get_item(
    pool: asyncpg.Pool, item_id: str
) -> Optional[ContentItemRecord]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id::text AS id, plan_id::text AS plan_id, publish_date,
                   post_type, topic, objective, outline, cta, status,
                   generated_text, final_text, image_url, image_prompt,
                   image_task_id, theme_id::text AS theme_id, dedup_status,
                   dedup_reason, retry_count, last_error, approved_by,
                   published_at, image_url_backup, image_backup_status
            FROM content_items
            WHERE id = $1
            """,
            item_id,
        )
        if row is None:
            return None
        return _row_to_item(row)


async def get_current_week_plan(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    week_start: date,
) -> Optional[ContentPlanRecord]:
    """Найти план недели по дате понедельника без триггера build_week_plan."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id::text AS id, project_id::text AS project_id,
                   week_start, week_end, status
            FROM content_plans
            WHERE project_id = $1 AND week_start = $2
            LIMIT 1
            """,
            project_id,
            week_start,
        )
        if row is None:
            return None
        return ContentPlanRecord(
            id=row["id"],
            project_id=row["project_id"],
            week_start=row["week_start"],
            week_end=row["week_end"],
            status=row["status"],
        )


async def list_items_by_status(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    statuses: tuple[str, ...],
    limit: int = 20,
) -> list[ContentItemRecord]:
    """Текущие items по статусу для очереди quality (например, quality_failed)."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT i.id::text AS id, i.plan_id::text AS plan_id, i.publish_date,
                   i.post_type, i.topic, i.objective, i.outline, i.cta, i.status,
                   i.generated_text, i.final_text, i.image_url, i.image_prompt,
                   i.image_task_id, i.theme_id::text AS theme_id, i.dedup_status,
                   i.dedup_reason, i.retry_count, i.last_error, i.approved_by,
                   i.published_at, i.image_url_backup, i.image_backup_status
            FROM content_items i
            JOIN content_plans p ON p.id = i.plan_id
            WHERE p.project_id = $1
              AND i.status = ANY($2::text[])
            ORDER BY i.publish_date ASC, i.post_type ASC
            LIMIT $3
            """,
            project_id,
            list(statuses),
            limit,
        )
        return [_row_to_item(row) for row in rows]


async def latest_quality_codes(
    pool: asyncpg.Pool, content_item_id: str
) -> Optional[str]:
    """Коды quality-проверок последней неуспешной попытки (для превью в админке)."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT error_code
            FROM prompts
            WHERE content_item_id = $1
              AND model_name = 'quality_gates'
              AND status = 'error'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            content_item_id,
        )
        if row is None or row["error_code"] is None:
            return None
        return str(row["error_code"])


async def latest_published_texts(
    pool: asyncpg.Pool, project_id: str, limit: int
) -> list[str]:
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT i.final_text
            FROM content_items i
            JOIN content_plans p ON p.id = i.plan_id
            WHERE p.project_id = $1
              AND i.status = 'published'
              AND i.final_text IS NOT NULL
            ORDER BY i.published_at DESC NULLS LAST
            LIMIT $2
            """,
            project_id,
            limit,
        )
        return [row["final_text"] for row in rows if row["final_text"]]


async def log_prompt(
    pool: asyncpg.Pool,
    *,
    content_item_id: str,
    prompt_type: str,
    prompt_text: str,
    model_name: str,
    raw_response: Optional[str],
    latency_ms: Optional[int],
    status: str = "ok",
    error_code: Optional[str] = None,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO prompts
                (content_item_id, prompt_type, prompt_text, model_name,
                 raw_response, latency_ms, status, error_code)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            content_item_id,
            prompt_type,
            prompt_text,
            model_name,
            raw_response,
            latency_ms,
            status,
            error_code,
        )


async def log_integration(
    pool: asyncpg.Pool,
    *,
    project_id: Optional[str],
    provider: str,
    operation: str,
    request_id: str,
    status: str,
    latency_ms: Optional[int],
    error_code: Optional[str],
    request_meta: dict,
    response_meta: dict,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO integration_logs
                (project_id, provider, operation, request_id, status, latency_ms,
                 error_code, request_meta, response_meta)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
            """,
            project_id,
            provider,
            operation,
            request_id,
            status,
            latency_ms,
            error_code,
            json.dumps(request_meta, ensure_ascii=False),
            json.dumps(response_meta, ensure_ascii=False),
        )


def _row_to_item(row) -> ContentItemRecord:
    backup_url = _safe_get(row, "image_url_backup")
    backup_status = _safe_get(row, "image_backup_status")
    return ContentItemRecord(
        id=row["id"],
        plan_id=row["plan_id"],
        publish_date=row["publish_date"],
        post_type=row["post_type"],
        topic=row["topic"],
        objective=row["objective"],
        outline=row["outline"],
        cta=row["cta"],
        status=row["status"],
        generated_text=row["generated_text"],
        final_text=row["final_text"],
        image_url=row["image_url"],
        image_prompt=row["image_prompt"],
        image_task_id=row["image_task_id"],
        theme_id=row["theme_id"],
        dedup_status=row["dedup_status"],
        dedup_reason=row["dedup_reason"],
        retry_count=int(row["retry_count"] or 0),
        last_error=row["last_error"],
        approved_by=int(row["approved_by"]) if row["approved_by"] else None,
        published_at=row["published_at"],
        image_url_backup=backup_url,
        image_backup_status=backup_status,
    )


def _safe_get(row, key: str):
    try:
        return row[key]
    except (KeyError, IndexError):
        return None


async def update_item_image_backup(
    pool: asyncpg.Pool,
    *,
    item_id: str,
    image_url_backup: Optional[str],
    image_backup_status: str,
) -> None:
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE content_items
            SET image_url_backup = $2,
                image_backup_status = $3,
                updated_at = NOW()
            WHERE id = $1
            """,
            item_id,
            image_url_backup,
            image_backup_status,
        )
