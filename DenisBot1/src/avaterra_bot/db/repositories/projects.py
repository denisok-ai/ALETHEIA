"""
@file: projects.py
@description: Репозиторий проектов и онбординг параметров
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

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


def normalize_website_url(value: str) -> str:
    """Привести `website_url` к каноничной форме: lower scheme/host + хвостовой `/`.

    Используется и в SELECT, и в INSERT, чтобы в `projects` не возникало двух
    строк для одного сайта (например `https://avaterra.pro` и
    `https://avaterra.pro/`).
    """
    raw = (value or "").strip()
    if not raw:
        return raw
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    scheme = (parsed.scheme or "https").lower()
    netloc = (parsed.netloc or "").lower()
    path = parsed.path or "/"
    if not path.endswith("/"):
        path = path + "/"
    return urlunparse((scheme, netloc, path, "", "", ""))


def _website_host(value: str) -> str:
    normalized = normalize_website_url(value)
    return urlparse(normalized).netloc


async def _warn_if_duplicate_projects(
    conn: asyncpg.Connection, host: str, keep_id: str
) -> None:
    """Если по одному канонизированному хосту в `projects` живёт >1 строки —
    логируем `projects_duplicate_host` со списком id/имён.
    """
    if not host:
        return
    rows = await conn.fetch(
        """
        SELECT id::text AS id, name, website_url
        FROM projects
        WHERE lower(regexp_replace(website_url, '^https?://', '')) LIKE $1
        ORDER BY created_at ASC
        """,
        f"{host.lower()}%",
    )
    if len(rows) <= 1:
        return
    siblings = [
        {"id": r["id"], "name": r["name"], "website_url": r["website_url"]}
        for r in rows
    ]
    logger.warning(
        "projects_duplicate_host",
        extra={
            "host": host,
            "kept_project_id": keep_id,
            "projects": siblings,
            "action_hint": (
                "перепривяжите content_plans/content_items на kept_project_id и "
                "удалите/деактивируйте лишние строки в projects"
            ),
        },
    )


async def ensure_default_project(
    pool: asyncpg.Pool,
    *,
    name: str,
    website_url: str,
    channel_id: int,
    timezone: str,
) -> ProjectRecord:
    """Найти или создать проект по канонизированному `website_url`.

    Поиск ведётся сначала по точному совпадению канонической формы, потом —
    fallback по совпадению хоста (нечувствительно к схеме/хвостовому слешу).
    Это закрывает старые записи с разными формами одного URL.
    """
    canonical = normalize_website_url(website_url)
    host = _website_host(canonical)
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id::text AS id, name, website_url, channel_id, timezone
            FROM projects
            WHERE website_url = $1
            ORDER BY created_at ASC
            LIMIT 1
            """,
            canonical,
        )
        if row is None and host:
            row = await conn.fetchrow(
                """
                SELECT id::text AS id, name, website_url, channel_id, timezone
                FROM projects
                WHERE lower(regexp_replace(website_url, '^https?://', '')) LIKE $1
                ORDER BY created_at ASC
                LIMIT 1
                """,
                f"{host.lower()}%",
            )
        if row is None:
            row = await conn.fetchrow(
                """
                INSERT INTO projects (name, website_url, channel_id, timezone)
                VALUES ($1, $2, $3, $4)
                RETURNING id::text AS id, name, website_url, channel_id, timezone
                """,
                name,
                canonical,
                channel_id,
                timezone,
            )
        if row is None:
            raise RuntimeError("failed to ensure default project")
        record = ProjectRecord(
            id=row["id"],
            name=row["name"],
            website_url=row["website_url"],
            channel_id=int(row["channel_id"]),
            timezone=row["timezone"],
        )
        await _warn_if_duplicate_projects(conn, host, record.id)
        return record
