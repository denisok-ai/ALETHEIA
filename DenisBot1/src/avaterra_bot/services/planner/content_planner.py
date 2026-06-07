"""
@file: content_planner.py
@description: 7-дневный контент-план Avaterra по типам из knowledge/avaterra.yaml
@dependencies: avaterra_bot.db.repositories.{content,theme_pool,brand}, deduplication
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

import asyncpg

from avaterra_bot.db.repositories.brand import BrandProfile, get_brand_profile
from avaterra_bot.db.repositories.content import (
    ContentPlanRecord,
    list_plan_items,
    upsert_item,
    upsert_plan,
)
from avaterra_bot.db.repositories.theme_pool import (
    ThemeRecord,
    fetch_pending_themes,
    mark_theme_status,
)
from avaterra_bot.services.deduplication import (
    DuplicateChecker,
    HistoricalFingerprint,
    build_minhash,
    extract_keywords,
    fingerprint,
)

logger = logging.getLogger(__name__)


WEEKDAY_TO_POST_TYPE_DEFAULT: dict[int, str] = {
    0: "educational",
    1: "pain",
    2: "practice",
    3: "author",
    4: "faq",
    5: "course",
    6: "reflection",
}

DEFAULT_OBJECTIVE_BY_TYPE: dict[str, str] = {
    "educational": "укрепить экспертность и доверие к подходу",
    "pain": "откликнуться болью и показать рабочую опору",
    "practice": "дать читателю микро-инструмент самонаблюдения",
    "author": "усилить доверие к автору и школе",
    "faq": "снять возражение и отвести в FAQ или на курс",
    "course": "мягко довести до целевого действия",
    "reflection": "закрыть неделю спокойной паузой и диалогом",
}

FALLBACK_TOPICS_BY_TYPE: dict[str, list[str]] = {
    "educational": [
        "Почему тело часто честнее головы",
        "Что такое мышечное тестирование простыми словами",
    ],
    "pain": [
        "Как понять, что вы живёте на автопилоте",
        "Я отдыхаю, но всё равно устаю — что внутри тела",
    ],
    "practice": [
        "Микро-наблюдение тела в обычном дне",
        "Один простой вопрос, который возвращает в тело",
    ],
    "author": [
        "Почему AVATERRA построена вокруг практики, а не теории",
        "Что значит быть основательницей школы и ведущим мастером",
    ],
    "faq": [
        "Это эзотерика? Спокойный ответ",
        "А если у меня не получится? Развёрнутый разбор",
    ],
    "course": [
        "Кому подойдёт курс «Тело не врёт»",
        "Что выбрать: «Тело не врёт» или «Пробуждение»",
    ],
    "reflection": [
        "Тихий вопрос на конец недели",
        "Что услышало ваше тело за эту неделю",
    ],
}

LEGACY_TYPE_MAP = {"info": "educational", "sales": "course"}


@dataclass
class PlanItemDraft:
    publish_date: date
    post_type: str
    topic: str
    objective: str
    outline: str
    cta: str
    theme_id: Optional[str]
    audience: Optional[str] = None
    rubric: Optional[str] = None


@dataclass
class WeekPlan:
    plan: ContentPlanRecord
    items: list[PlanItemDraft]


def week_bounds(today: date) -> tuple[date, date]:
    """Понедельник-воскресенье ближайшей недели от `today`."""
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _post_types_schedule(brand: BrandProfile, posts_per_week: int) -> dict[int, str]:
    """Карта `weekday -> post_type` из brand.templates или из дефолта."""
    templates = brand.templates if brand else []
    schedule: dict[int, str] = {}
    weekday_index = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    for tpl in templates or []:
        post_type = tpl.get("id")
        weekday = tpl.get("weekday")
        if not post_type or weekday not in weekday_index:
            continue
        schedule[weekday_index[weekday]] = post_type
    if not schedule:
        schedule = dict(WEEKDAY_TO_POST_TYPE_DEFAULT)
    if posts_per_week == 3:
        return {0: "educational", 2: "educational", 4: "course"}
    return schedule


def _publish_dates_in_week(monday: date, schedule: dict[int, str]) -> list[tuple[date, str]]:
    return [
        (monday + timedelta(days=offset), schedule[offset])
        for offset in sorted(schedule.keys())
    ]


def _find_template(brand: BrandProfile, post_type: str) -> dict:
    for tpl in brand.templates or []:
        if tpl.get("id") == post_type:
            return tpl
    return {}


def _pick_cta(brand: BrandProfile, kind: str) -> str:
    library = brand.cta_library or {}
    options = library.get(kind) or library.get("soft") or []
    if options:
        return options[0]
    return "Сохраните пост и поделитесь с тем, кому это сейчас близко."


async def _pick_unique_theme(
    pool: asyncpg.Pool,
    project_id: str,
    *,
    post_type: str,
    rubric: Optional[str],
    audience: Optional[str],
    used_topics: list[str],
    fallback_index: int = 0,
) -> tuple[Optional[ThemeRecord], str]:
    """Подобрать тему: сначала по (post_type, rubric, audience), потом мягче."""

    async def _by(filters: dict) -> Optional[ThemeRecord]:
        candidates = await fetch_pending_themes(
            pool, project_id, limit=10, **filters
        )
        checker = DuplicateChecker()
        for candidate in candidates:
            history = [
                HistoricalFingerprint(
                    reference_id=str(idx),
                    minhash=build_minhash(t),
                    keywords=tuple(extract_keywords(t)),
                )
                for idx, t in enumerate(used_topics)
            ]
            if checker.check(fingerprint(candidate.topic), history).is_duplicate:
                continue
            return candidate
        return None

    for filters in [
        {"post_type": post_type, "rubric": rubric, "audience": audience},
        {"post_type": post_type, "rubric": rubric},
        {"post_type": post_type, "audience": audience},
        {"post_type": post_type},
    ]:
        theme = await _by(filters)
        if theme:
            return theme, theme.topic

    fallback_pool = FALLBACK_TOPICS_BY_TYPE.get(post_type) or []
    if fallback_pool:
        topic = fallback_pool[fallback_index % len(fallback_pool)]
        return None, topic
    return None, f"Резервная тема для {post_type}-поста"


def _build_outline(template: dict, theme: Optional[ThemeRecord]) -> str:
    steps = template.get("structure") or []
    if not steps:
        return "Боль аудитории → разбор → польза → CTA."
    rendered = " → ".join(steps)
    angle = (theme.angle if theme else None) or template.get("objective", "")
    if angle:
        return f"{rendered}. Ракурс: {angle}."
    return rendered


async def build_week_plan(
    pool: asyncpg.Pool,
    project_id: str,
    today: Optional[date] = None,
    *,
    posts_per_week: int = 7,
) -> WeekPlan:
    today = today or date.today()
    monday, sunday = week_bounds(today)
    plan = await upsert_plan(
        pool,
        project_id=project_id,
        week_start=monday,
        week_end=sunday,
    )

    brand = await get_brand_profile(pool, project_id) or BrandProfile(project_id=project_id)
    schedule = _post_types_schedule(brand, posts_per_week)

    existing_items = await list_plan_items(pool, plan.id)
    used_topics = [item.topic for item in existing_items]
    drafts: list[PlanItemDraft] = []
    fallback_counters: dict[str, int] = {pt: 0 for pt in WEEKDAY_TO_POST_TYPE_DEFAULT.values()}

    for publish_date, post_type in _publish_dates_in_week(monday, schedule):
        existing = next(
            (
                item
                for item in existing_items
                if item.publish_date == publish_date
                and (item.post_type == post_type
                     or LEGACY_TYPE_MAP.get(item.post_type) == post_type)
            ),
            None,
        )
        if existing and existing.status not in {"draft"}:
            drafts.append(
                PlanItemDraft(
                    publish_date=existing.publish_date,
                    post_type=existing.post_type,
                    topic=existing.topic,
                    objective=existing.objective,
                    outline=existing.outline or "",
                    cta=existing.cta or "",
                    theme_id=existing.theme_id,
                )
            )
            continue

        template = _find_template(brand, post_type)
        rubric = template.get("default_rubric")
        audience = template.get("default_audience")
        cta_kind = template.get("default_cta") or "soft"
        objective = template.get("objective") or DEFAULT_OBJECTIVE_BY_TYPE.get(
            post_type, "развивать канал бренда"
        )

        theme, topic = await _pick_unique_theme(
            pool,
            project_id,
            post_type=post_type,
            rubric=rubric,
            audience=audience,
            used_topics=used_topics,
            fallback_index=fallback_counters.get(post_type, 0),
        )
        if theme is None:
            fallback_counters[post_type] = fallback_counters.get(post_type, 0) + 1
        used_topics.append(topic)

        outline = _build_outline(template, theme)
        cta = _pick_cta(brand, cta_kind)

        await upsert_item(
            pool,
            plan_id=plan.id,
            publish_date=publish_date,
            post_type=post_type,
            topic=topic,
            objective=objective,
            outline=outline,
            cta=cta,
            theme_id=theme.id if theme else None,
        )
        if theme is not None:
            await mark_theme_status(pool, theme.id, "scheduled")
        drafts.append(
            PlanItemDraft(
                publish_date=publish_date,
                post_type=post_type,
                topic=topic,
                objective=objective,
                outline=outline,
                cta=cta,
                theme_id=theme.id if theme else None,
                audience=audience,
                rubric=rubric,
            )
        )

    logger.info(
        "content_plan_built",
        extra={
            "plan_id": plan.id,
            "week_start": monday.isoformat(),
            "items": len(drafts),
            "schedule": schedule,
        },
    )
    return WeekPlan(plan=plan, items=drafts)
