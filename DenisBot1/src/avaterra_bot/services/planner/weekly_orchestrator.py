"""
@file: weekly_orchestrator.py
@description: Подготовка плана + генерация всех 3 постов недели
@dependencies: planner, generator, brand
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import asyncpg
from aiogram import Bot

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.brand import (
    BrandProfile,
    ensure_default_brand_profile,
)
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    list_plan_items,
)
from avaterra_bot.services.external.deepseek import DeepSeekClient
from avaterra_bot.services.external.kie import KieClient
from avaterra_bot.services.generator.pipeline import (
    PreparationOutcome,
    prepare_item,
)
from avaterra_bot.services.planner.content_planner import (
    WeekPlan,
    build_week_plan,
)

logger = logging.getLogger(__name__)


@dataclass
class WeeklyOutcome:
    plan_id: str
    items_total: int
    items_prepared: int
    items_blocked: int
    outcomes: list[PreparationOutcome]


async def run_weekly_pipeline(
    bot: Bot,
    pool: asyncpg.Pool,
    *,
    project_id: str,
    settings: AppSettings,
) -> WeeklyOutcome:
    """План на неделю + генерация всех постов в статусе draft."""
    brand = await ensure_default_brand_profile(pool, project_id)
    plan_obj: WeekPlan = await build_week_plan(
        pool, project_id, posts_per_week=settings.posts_per_week
    )

    deepseek = DeepSeekClient(settings)
    kie = KieClient(settings)

    items: list[ContentItemRecord] = await list_plan_items(pool, plan_obj.plan.id)
    outcomes: list[PreparationOutcome] = []
    blocked = 0
    prepared = 0
    for item in items:
        if item.status not in {"draft", "failed", "dedup_blocked"}:
            continue
        try:
            outcome = await prepare_item(
                pool,
                project_id=project_id,
                item=item,
                brand=brand,
                settings=settings,
                deepseek=deepseek,
                kie=kie,
            )
        except Exception:
            logger.exception(
                "weekly_pipeline_item_failed", extra={"item_id": item.id}
            )
            continue
        outcomes.append(outcome)
        if outcome.status in {"dedup_blocked", "quality_failed"}:
            blocked += 1
        else:
            prepared += 1

    return WeeklyOutcome(
        plan_id=plan_obj.plan.id,
        items_total=len(items),
        items_prepared=prepared,
        items_blocked=blocked,
        outcomes=outcomes,
    )
