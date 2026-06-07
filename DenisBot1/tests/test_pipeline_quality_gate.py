"""
@file: test_pipeline_quality_gate.py
@description: Регрессионный тест на критичный баг: pipeline пропускал quality_failed дальше в KIE и публикацию
@dependencies: services.generator.pipeline, services.generator.text_generator, services.generator.image_generator
@created: 2026-05-07
"""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.db.repositories.content import ContentItemRecord
from avaterra_bot.services.generator import image_generator as image_generator_module
from avaterra_bot.services.generator import pipeline as pipeline_module
from avaterra_bot.services.generator.image_generator import (
    ImageGenerationOutcome,
    generate_image_for_item,
)
from avaterra_bot.services.generator.pipeline import prepare_item
from avaterra_bot.services.generator.text_generator import TextGenerationOutcome


def _draft_item(status: str = "draft") -> ContentItemRecord:
    return ContentItemRecord(
        id="11111111-1111-1111-1111-111111111111",
        plan_id="22222222-2222-2222-2222-222222222222",
        publish_date=date(2026, 5, 7),
        post_type="educational",
        topic="Постоянная боль в спине: что стоит проверить",
        objective="доверие",
        outline="вступление -> разбор -> CTA",
        cta="Сохраните пост",
        status=status,
        generated_text=None,
        final_text=None,
        image_url=None,
        image_prompt=None,
        image_task_id=None,
        theme_id=None,
        dedup_status=None,
        dedup_reason=None,
        retry_count=0,
        last_error=None,
        approved_by=None,
        published_at=None,
    )


@pytest.mark.asyncio
async def test_pipeline_short_circuits_on_quality_failed(monkeypatch):
    """Pipeline не должен звать image_generator, если quality_passed=False."""
    item = _draft_item()

    text_outcome = TextGenerationOutcome(
        item_id=item.id,
        text="плохой текст с обещанием 'мы вылечим'",
        dry_run=False,
        dedup_status="passed",
        dedup_reason="ok",
        quality_passed=False,
        quality_codes=["prohibited_phrase"],
    )

    text_mock = AsyncMock(return_value=text_outcome)
    image_mock = AsyncMock(return_value=None)

    monkeypatch.setattr(pipeline_module, "generate_text_for_item", text_mock)
    monkeypatch.setattr(pipeline_module, "generate_image_for_item", image_mock)
    monkeypatch.setattr(pipeline_module, "get_item", AsyncMock(return_value=item))

    settings = MagicMock()
    settings.image_backup_enabled = False
    brand = BrandProfile(project_id="00000000-0000-0000-0000-000000000000")

    outcome = await prepare_item(
        pool=MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        item=item,
        brand=brand,
        settings=settings,
        deepseek=MagicMock(),
        kie=MagicMock(),
    )

    assert outcome.status == "quality_failed"
    assert outcome.has_image is False
    assert outcome.image_url is None
    assert outcome.dedup_status == "passed"
    text_mock.assert_awaited_once()
    image_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_pipeline_passes_through_when_quality_passed(monkeypatch):
    """Контрольный сценарий: quality_passed=True -> image_generator должен быть вызван."""
    item = _draft_item()

    text_outcome = TextGenerationOutcome(
        item_id=item.id,
        text="ok",
        dry_run=False,
        dedup_status="passed",
        dedup_reason="ok",
        quality_passed=True,
        quality_codes=[],
    )

    image_outcome = ImageGenerationOutcome(
        item_id=item.id,
        image_url="https://kie/img.jpg",
        task_id="t1",
        dry_run=False,
    )

    monkeypatch.setattr(
        pipeline_module, "generate_text_for_item", AsyncMock(return_value=text_outcome)
    )
    image_mock = AsyncMock(return_value=image_outcome)
    monkeypatch.setattr(pipeline_module, "generate_image_for_item", image_mock)
    monkeypatch.setattr(
        pipeline_module,
        "get_item",
        AsyncMock(return_value=ContentItemRecord(**{**item.__dict__, "status": "ready"})),
    )

    settings = MagicMock()
    settings.image_backup_enabled = False
    brand = BrandProfile(project_id="00000000-0000-0000-0000-000000000000")

    outcome = await prepare_item(
        pool=MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        item=item,
        brand=brand,
        settings=settings,
        deepseek=MagicMock(),
        kie=MagicMock(),
    )

    image_mock.assert_awaited_once()
    assert outcome.status == "ready"
    assert outcome.has_image is True
    assert outcome.image_url == "https://kie/img.jpg"


@pytest.mark.asyncio
async def test_image_generator_skips_for_non_publishable_status(monkeypatch):
    """Defense-in-depth: image_generator не дёргает KIE и не пишет в БД, если item уже в quality_failed."""
    item = _draft_item(status="quality_failed")

    kie_mock = MagicMock()
    kie_mock.generate_image = AsyncMock(side_effect=AssertionError("KIE must not be called"))

    update_image_mock = AsyncMock()
    monkeypatch.setattr(
        image_generator_module, "update_item_image", update_image_mock
    )
    monkeypatch.setattr(
        image_generator_module, "log_prompt", AsyncMock()
    )
    monkeypatch.setattr(
        image_generator_module, "log_integration", AsyncMock()
    )

    settings = MagicMock()
    settings.image_backup_enabled = False
    settings.kie_model = "stub"

    outcome = await generate_image_for_item(
        pool=MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        item=item,
        settings=settings,
        kie=kie_mock,
    )

    assert outcome.skipped is True
    assert outcome.image_url == ""
    update_image_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_image_generator_skips_for_dedup_blocked_status(monkeypatch):
    """Та же защита для dedup_blocked."""
    item = _draft_item(status="dedup_blocked")

    update_image_mock = AsyncMock()
    monkeypatch.setattr(
        image_generator_module, "update_item_image", update_image_mock
    )
    monkeypatch.setattr(
        image_generator_module, "log_prompt", AsyncMock()
    )
    monkeypatch.setattr(
        image_generator_module, "log_integration", AsyncMock()
    )

    settings = MagicMock()
    settings.image_backup_enabled = False
    settings.kie_model = "stub"

    outcome = await generate_image_for_item(
        pool=MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        item=item,
        settings=settings,
        kie=MagicMock(),
    )

    assert outcome.skipped is True
    update_image_mock.assert_not_awaited()
