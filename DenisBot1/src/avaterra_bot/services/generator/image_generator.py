"""
@file: image_generator.py
@description: Генерация изображения через KIE и сохранение URL/task_id
@dependencies: kie client, content repository
@created: 2026-05-07
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass

import asyncpg

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    log_integration,
    log_prompt,
    update_item_image,
    update_item_image_backup,
)
from avaterra_bot.services.external.kie import KieClient, KieError
from avaterra_bot.services.generator.prompts import (
    GenerationRequest,
    build_image_prompt,
)
from avaterra_bot.services.storage.image_backup import (
    ImageBackupError,
    backup_image,
)

logger = logging.getLogger(__name__)

NON_PUBLISHABLE_STATUSES = frozenset(
    {"quality_failed", "dedup_blocked", "failed"}
)


@dataclass
class ImageGenerationOutcome:
    item_id: str
    image_url: str
    task_id: str
    dry_run: bool
    skipped: bool = False


async def generate_image_for_item(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    settings: AppSettings,
    kie: KieClient,
) -> ImageGenerationOutcome:
    if item.status in NON_PUBLISHABLE_STATUSES:
        logger.info(
            "image_generation_skipped",
            extra={"item_id": item.id, "status": item.status},
        )
        return ImageGenerationOutcome(
            item_id=item.id,
            image_url=item.image_url or "",
            task_id=item.image_task_id or "",
            dry_run=False,
            skipped=True,
        )

    request = GenerationRequest(
        post_type=item.post_type,
        topic=item.topic,
        objective=item.objective,
        outline=item.outline or "",
        cta=item.cta or "",
    )
    prompt = build_image_prompt(request=request)
    request_id = uuid.uuid4().hex
    t0 = time.monotonic()
    try:
        result = await kie.generate_image(prompt=prompt)
    except KieError as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        await log_prompt(
            pool,
            content_item_id=item.id,
            prompt_type="image",
            prompt_text=prompt,
            model_name=settings.kie_model,
            raw_response=None,
            latency_ms=latency_ms,
            status="error",
            error_code=str(exc)[:200],
        )
        await log_integration(
            pool,
            project_id=project_id,
            provider="kie",
            operation="images.generate",
            request_id=request_id,
            status="error",
            latency_ms=latency_ms,
            error_code=str(exc)[:200],
            request_meta={"prompt_type": "image"},
            response_meta={},
        )
        raise

    await log_prompt(
        pool,
        content_item_id=item.id,
        prompt_type="image",
        prompt_text=prompt,
        model_name=result.model,
        raw_response=str(result.raw_response)[:4000],
        latency_ms=result.latency_ms,
        status="ok",
    )
    await log_integration(
        pool,
        project_id=project_id,
        provider="kie",
        operation="images.generate",
        request_id=request_id,
        status="ok",
        latency_ms=result.latency_ms,
        error_code=None,
        request_meta={"prompt_type": "image"},
        response_meta={
            "task_id": result.task_id,
            "model": result.model,
            "dry_run": result.dry_run,
        },
    )

    await update_item_image(
        pool,
        item_id=item.id,
        image_url=result.image_url,
        image_prompt=prompt,
        image_task_id=result.task_id,
        status="ready",
    )

    if settings.image_backup_enabled and not result.dry_run and result.image_url:
        try:
            backup = await backup_image(
                item_id=item.id,
                source_url=result.image_url,
                settings=settings,
            )
            if backup is not None:
                await update_item_image_backup(
                    pool,
                    item_id=item.id,
                    image_url_backup=backup.backup_url,
                    image_backup_status=f"ok:{backup.storage}",
                )
                logger.info(
                    "image_backup_ok",
                    extra={
                        "item_id": item.id,
                        "storage": backup.storage,
                    },
                )
        except ImageBackupError as exc:
            logger.warning(
                "image_backup_failed",
                extra={"item_id": item.id, "reason": str(exc)},
            )
            await update_item_image_backup(
                pool,
                item_id=item.id,
                image_url_backup=None,
                image_backup_status="failed",
            )

    return ImageGenerationOutcome(
        item_id=item.id,
        image_url=result.image_url,
        task_id=result.task_id,
        dry_run=result.dry_run,
    )
