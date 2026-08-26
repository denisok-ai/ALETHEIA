"""
@file: pipeline.py
@description: Полный цикл подготовки одного поста: текст -> картинка -> готов к публикации
@dependencies: text_generator, image_generator
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import asyncpg

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    get_item,
)
from avaterra_bot.services.external.deepseek import DeepSeekClient
from avaterra_bot.services.external.kie import KieClient
from avaterra_bot.services.generator.image_generator import generate_image_for_item
from avaterra_bot.services.generator.text_generator import generate_text_for_item

logger = logging.getLogger(__name__)


@dataclass
class PreparationOutcome:
    item_id: str
    status: str
    has_text: bool
    has_image: bool
    text_preview: str
    image_url: str | None
    dedup_status: str | None


async def prepare_item(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    brand: BrandProfile,
    settings: AppSettings,
    deepseek: DeepSeekClient,
    kie: KieClient,
) -> PreparationOutcome:
    text_outcome = await generate_text_for_item(
        pool,
        project_id=project_id,
        item=item,
        brand=brand,
        settings=settings,
        deepseek=deepseek,
    )
    if text_outcome.dedup_status == "blocked":
        logger.warning(
            "content_item_dedup_blocked",
            extra={"item_id": item.id, "reason": text_outcome.dedup_reason},
        )
        return PreparationOutcome(
            item_id=item.id,
            status="dedup_blocked",
            has_text=True,
            has_image=False,
            text_preview=text_outcome.text[:160],
            image_url=None,
            dedup_status="blocked",
        )

    if not text_outcome.quality_passed:
        logger.warning(
            "content_item_quality_failed",
            extra={
                "item_id": item.id,
                "codes": text_outcome.quality_codes,
            },
        )
        return PreparationOutcome(
            item_id=item.id,
            status="quality_failed",
            has_text=True,
            has_image=False,
            text_preview=text_outcome.text[:160],
            image_url=None,
            dedup_status=text_outcome.dedup_status,
        )

    refreshed = await get_item(pool, item.id) or item
    image_outcome = await generate_image_for_item(
        pool,
        project_id=project_id,
        item=refreshed,
        settings=settings,
        kie=kie,
    )
    final = await get_item(pool, item.id)
    return PreparationOutcome(
        item_id=item.id,
        status=final.status if final else "ready",
        has_text=True,
        has_image=True,
        text_preview=text_outcome.text[:160],
        image_url=image_outcome.image_url,
        dedup_status=text_outcome.dedup_status,
    )


async def complete_image_for_item(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    settings: AppSettings,
    kie: KieClient,
) -> PreparationOutcome:
    """Догенерировать только картинку для поста, который застрял в `text_ready`.

    Используется в недельном пайплайне на повторном проходе, когда текст
    уже прошёл quality gates, но генерация изображения упала и item
    остался без `image_url`.
    """
    image_outcome = await generate_image_for_item(
        pool,
        project_id=project_id,
        item=item,
        settings=settings,
        kie=kie,
    )
    final = await get_item(pool, item.id)
    text_preview = (item.final_text or item.generated_text or "")[:160]
    return PreparationOutcome(
        item_id=item.id,
        status=final.status if final else "ready",
        has_text=True,
        has_image=bool(image_outcome.image_url),
        text_preview=text_preview,
        image_url=image_outcome.image_url,
        dedup_status=item.dedup_status,
    )
