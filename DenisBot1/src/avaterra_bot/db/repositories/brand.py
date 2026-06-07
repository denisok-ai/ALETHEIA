"""
@file: brand.py
@description: Репозиторий профиля бренда (TOV, аудитории, продукты, CTA, дисклеймер) и загрузка из Knowledge Base
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional

import asyncpg


@dataclass
class BrandProfile:
    project_id: str
    tone_of_voice: str = ""
    style_rules: dict = field(default_factory=dict)
    prohibited_topics: list[str] = field(default_factory=list)
    target_audience: dict = field(default_factory=dict)
    goals: list[str] = field(default_factory=list)
    audiences: list[dict] = field(default_factory=list)
    products: dict = field(default_factory=dict)
    author: dict = field(default_factory=dict)
    rubrics: list[dict] = field(default_factory=list)
    templates: list[dict] = field(default_factory=list)
    cta_library: dict = field(default_factory=dict)
    prohibited_phrases: list[str] = field(default_factory=list)
    safe_replacements: dict = field(default_factory=dict)
    disclaimer: dict = field(default_factory=dict)
    quick_links: dict = field(default_factory=dict)
    text_whitelist: list[str] = field(default_factory=list)
    kb_version: Optional[str] = None


DEFAULT_TOV_AVATERRA = (
    "Авторский, экспертный, тёплый. Простой человеческий язык. "
    "Без воды, без агрессивных продаж, без эзотерических штампов. "
    "Уважение к читателю и его опыту."
)
DEFAULT_STYLE_RULES = {
    "max_post_length": 3500,
    "max_paragraph_length": 600,
    "use_emojis": False,
    "use_hashtags": False,
    "structure": "проблема → разбор → выгода → CTA",
    "language": "ru",
}
DEFAULT_PROHIBITED = [
    "обещания исцеления и медицинские заявления",
    "психо-эзотерический хайп",
    "оценочные суждения о клиентах",
    "сравнение с другими школами и экспертами",
]
DEFAULT_AUDIENCE = {
    "core": "женщины 30-55, ищут осознанность и работу с телом",
    "pains": [
        "хронический стресс и усталость",
        "ощущение, что тело не слушается",
        "сложности с принятием решений",
    ],
    "goals": [
        "найти доступ к ресурсу тела",
        "научиться слышать себя",
        "освоить безопасный инструмент работы со стрессом",
    ],
}
DEFAULT_GOALS = [
    "увеличить количество подписчиков канала Avaterra",
    "выводить заявки на курсы через мини-воронку",
    "сформировать доверие к мышечному тестированию как инструменту",
]


async def ensure_default_brand_profile(
    pool: asyncpg.Pool, project_id: str
) -> BrandProfile:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO brand_profiles
                (project_id, tone_of_voice, style_rules, prohibited_topics,
                 target_audience, goals)
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
            ON CONFLICT (project_id) DO UPDATE
                SET updated_at = NOW()
            RETURNING project_id::text AS project_id, tone_of_voice, style_rules,
                      prohibited_topics, target_audience, goals,
                      audiences, products, author, rubrics, templates,
                      cta_library, prohibited_phrases, safe_replacements,
                      disclaimer, quick_links, text_whitelist, kb_version
            """,
            project_id,
            DEFAULT_TOV_AVATERRA,
            json.dumps(DEFAULT_STYLE_RULES, ensure_ascii=False),
            json.dumps(DEFAULT_PROHIBITED, ensure_ascii=False),
            json.dumps(DEFAULT_AUDIENCE, ensure_ascii=False),
            json.dumps(DEFAULT_GOALS, ensure_ascii=False),
        )
        return _row_to_profile(row)


async def get_brand_profile(
    pool: asyncpg.Pool, project_id: str
) -> BrandProfile | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT project_id::text AS project_id, tone_of_voice, style_rules,
                   prohibited_topics, target_audience, goals,
                   audiences, products, author, rubrics, templates,
                   cta_library, prohibited_phrases, safe_replacements,
                   disclaimer, quick_links, text_whitelist, kb_version
            FROM brand_profiles
            WHERE project_id = $1
            """,
            project_id,
        )
        if row is None:
            return None
        return _row_to_profile(row)


async def upsert_kb_into_brand_profile(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    kb: dict[str, Any],
    kb_version: str,
) -> BrandProfile:
    """Записать в brand_profiles все JSONB-поля из YAML KB."""
    brand_section = kb.get("brand", {}) or {}
    tone_of_voice = (brand_section.get("tone_of_voice") or "").strip() or DEFAULT_TOV_AVATERRA
    goals = list(brand_section.get("goals") or DEFAULT_GOALS)

    style_rules = {
        **DEFAULT_STYLE_RULES,
        "positioning": brand_section.get("positioning"),
        "big_idea": brand_section.get("big_idea"),
        "tov_dos": brand_section.get("tov_dos") or [],
        "tov_donts": brand_section.get("tov_donts") or [],
    }

    audiences = list(kb.get("audiences") or [])
    primary_audience = audiences[0] if audiences else {}
    target_audience = {
        "core": primary_audience.get("name") or DEFAULT_AUDIENCE["core"],
        "pains": list(primary_audience.get("pains") or DEFAULT_AUDIENCE["pains"]),
        "goals": list(primary_audience.get("search") or DEFAULT_AUDIENCE["goals"]),
    }

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO brand_profiles
                (project_id, tone_of_voice, style_rules, prohibited_topics,
                 target_audience, goals,
                 audiences, products, author, rubrics, templates,
                 cta_library, prohibited_phrases, safe_replacements,
                 disclaimer, quick_links, text_whitelist, kb_version)
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb,
                    $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
                    $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb,
                    $17::jsonb, $18)
            ON CONFLICT (project_id) DO UPDATE
                SET tone_of_voice = EXCLUDED.tone_of_voice,
                    style_rules = EXCLUDED.style_rules,
                    target_audience = EXCLUDED.target_audience,
                    goals = EXCLUDED.goals,
                    audiences = EXCLUDED.audiences,
                    products = EXCLUDED.products,
                    author = EXCLUDED.author,
                    rubrics = EXCLUDED.rubrics,
                    templates = EXCLUDED.templates,
                    cta_library = EXCLUDED.cta_library,
                    prohibited_phrases = EXCLUDED.prohibited_phrases,
                    safe_replacements = EXCLUDED.safe_replacements,
                    disclaimer = EXCLUDED.disclaimer,
                    quick_links = EXCLUDED.quick_links,
                    text_whitelist = EXCLUDED.text_whitelist,
                    kb_version = EXCLUDED.kb_version,
                    updated_at = NOW()
            RETURNING project_id::text AS project_id, tone_of_voice, style_rules,
                      prohibited_topics, target_audience, goals,
                      audiences, products, author, rubrics, templates,
                      cta_library, prohibited_phrases, safe_replacements,
                      disclaimer, quick_links, text_whitelist, kb_version
            """,
            project_id,
            tone_of_voice,
            json.dumps(style_rules, ensure_ascii=False),
            json.dumps(DEFAULT_PROHIBITED, ensure_ascii=False),
            json.dumps(target_audience, ensure_ascii=False),
            json.dumps(goals, ensure_ascii=False),
            json.dumps(audiences, ensure_ascii=False),
            json.dumps(kb.get("products") or {}, ensure_ascii=False),
            json.dumps(kb.get("author") or {}, ensure_ascii=False),
            json.dumps(kb.get("rubrics") or [], ensure_ascii=False),
            json.dumps(kb.get("post_types") or [], ensure_ascii=False),
            json.dumps(kb.get("cta_library") or {}, ensure_ascii=False),
            json.dumps(kb.get("prohibited_phrases") or [], ensure_ascii=False),
            json.dumps(kb.get("safe_replacements") or {}, ensure_ascii=False),
            json.dumps(kb.get("disclaimer") or {}, ensure_ascii=False),
            json.dumps(kb.get("quick_links") or {}, ensure_ascii=False),
            json.dumps(kb.get("text_whitelist_terms") or [], ensure_ascii=False),
            kb_version,
        )
        return _row_to_profile(row)


def _coerce(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return default
    return value


def _row_to_profile(row) -> BrandProfile:
    return BrandProfile(
        project_id=row["project_id"],
        tone_of_voice=row["tone_of_voice"] or "",
        style_rules=_coerce(row["style_rules"], {}),
        prohibited_topics=list(_coerce(row["prohibited_topics"], []) or []),
        target_audience=_coerce(row["target_audience"], {}),
        goals=list(_coerce(row["goals"], []) or []),
        audiences=list(_coerce(_get(row, "audiences"), []) or []),
        products=_coerce(_get(row, "products"), {}),
        author=_coerce(_get(row, "author"), {}),
        rubrics=list(_coerce(_get(row, "rubrics"), []) or []),
        templates=list(_coerce(_get(row, "templates"), []) or []),
        cta_library=_coerce(_get(row, "cta_library"), {}),
        prohibited_phrases=list(_coerce(_get(row, "prohibited_phrases"), []) or []),
        safe_replacements=_coerce(_get(row, "safe_replacements"), {}),
        disclaimer=_coerce(_get(row, "disclaimer"), {}),
        quick_links=_coerce(_get(row, "quick_links"), {}),
        text_whitelist=list(_coerce(_get(row, "text_whitelist"), []) or []),
        kb_version=_get(row, "kb_version"),
    )


def _get(row, key: str):
    try:
        return row[key]
    except (KeyError, IndexError):
        return None
