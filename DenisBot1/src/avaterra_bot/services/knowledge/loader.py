"""
@file: loader.py
@description: Загрузчик YAML-базы знаний AVATERRA в brand_profiles и theme_pool
@dependencies: pyyaml, asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import asyncpg
import yaml

from avaterra_bot.db.repositories.brand import (
    BrandProfile,
    upsert_kb_into_brand_profile,
)

logger = logging.getLogger(__name__)


REQUIRED_TOP_KEYS = (
    "brand",
    "audiences",
    "products",
    "author",
    "rubrics",
    "post_types",
    "cta_library",
    "prohibited_phrases",
    "safe_replacements",
    "disclaimer",
    "theme_bank",
)


@dataclass(frozen=True)
class KbApplyOutcome:
    project_id: str
    kb_version: str
    audiences: int
    rubrics: int
    post_types: int
    themes_inserted: int
    themes_updated: int


def load_yaml(path: str | Path) -> dict[str, Any]:
    raw = Path(path).read_text(encoding="utf-8")
    data = yaml.safe_load(raw)
    if not isinstance(data, dict):
        raise ValueError(f"KB YAML must be a mapping, got {type(data).__name__}")
    missing = [key for key in REQUIRED_TOP_KEYS if key not in data]
    if missing:
        raise ValueError(f"KB YAML is missing required sections: {missing}")
    return data


def kb_version_from_payload(kb: dict[str, Any]) -> str:
    payload = json.dumps(kb, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:16]


async def apply_kb_to_project(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    kb_path: str | Path,
) -> tuple[BrandProfile, KbApplyOutcome]:
    """Применить YAML KB к проекту: обновить brand_profile и заполнить theme_pool."""
    kb = load_yaml(kb_path)
    version = kb_version_from_payload(kb)
    profile = await upsert_kb_into_brand_profile(
        pool, project_id=project_id, kb=kb, kb_version=version
    )
    inserted, updated = await _seed_theme_pool(pool, project_id, kb)
    outcome = KbApplyOutcome(
        project_id=project_id,
        kb_version=version,
        audiences=len(kb.get("audiences") or []),
        rubrics=len(kb.get("rubrics") or []),
        post_types=len(kb.get("post_types") or []),
        themes_inserted=inserted,
        themes_updated=updated,
    )
    logger.info(
        "kb_applied",
        extra={
            "project_id": project_id,
            "kb_version": version,
            "themes_inserted": inserted,
            "themes_updated": updated,
        },
    )
    return profile, outcome


async def _seed_theme_pool(
    pool: asyncpg.Pool,
    project_id: str,
    kb: dict[str, Any],
) -> tuple[int, int]:
    """Залить темы из theme_bank в theme_pool как source='kb'. Идемпотентно."""
    themes = kb.get("theme_bank") or []
    inserted = 0
    updated = 0
    async with pool.acquire() as conn:
        for theme in themes:
            topic = (theme.get("topic") or "").strip()
            if not topic:
                continue
            post_type = theme.get("post_type") or "educational"
            audience = theme.get("audience")
            rubric = theme.get("rubric")
            payload = {
                k: v
                for k, v in theme.items()
                if k not in {"topic", "post_type", "audience", "rubric"}
            }
            existing = await conn.fetchrow(
                """
                SELECT id::text AS id, status
                FROM theme_pool
                WHERE project_id = $1 AND source = 'kb' AND topic = $2
                """,
                project_id,
                topic,
            )
            if existing is None:
                await conn.execute(
                    """
                    INSERT INTO theme_pool (
                        project_id, topic, post_type, audience, rubric,
                        priority, status, source, payload
                    )
                    VALUES ($1, $2, $3, $4, $5, 60, 'pending', 'kb', $6::jsonb)
                    """,
                    project_id,
                    topic,
                    post_type,
                    audience,
                    rubric,
                    json.dumps(payload, ensure_ascii=False),
                )
                inserted += 1
            else:
                await conn.execute(
                    """
                    UPDATE theme_pool
                    SET post_type = $2,
                        audience = $3,
                        rubric = $4,
                        payload = $5::jsonb,
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    existing["id"],
                    post_type,
                    audience,
                    rubric,
                    json.dumps(payload, ensure_ascii=False),
                )
                updated += 1
    return inserted, updated
