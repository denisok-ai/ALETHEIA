"""
@file: test_image_generation_disabled.py
@description: Тесты отключения генерации изображений через IMAGE_GENERATION_ENABLED
@dependencies: avaterra_bot.services.generator.image_generator
@created: 2026-05-20
"""

from __future__ import annotations

from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from avaterra_bot.db.repositories.content import ContentItemRecord
from avaterra_bot.services.generator import image_generator as image_generator_module
from avaterra_bot.services.generator.image_generator import generate_image_for_item


def _text_ready_item() -> ContentItemRecord:
    return ContentItemRecord(
        id="11111111-1111-1111-1111-111111111111",
        plan_id="22222222-2222-2222-2222-222222222222",
        publish_date=date(2026, 5, 20),
        post_type="educational",
        topic="Тестовая тема",
        objective="доверие",
        outline="outline",
        cta="CTA",
        status="text_ready",
        generated_text="Текст поста",
        final_text=None,
        image_url=None,
        image_prompt=None,
        image_task_id=None,
        theme_id=None,
        dedup_status="passed",
        dedup_reason=None,
        retry_count=0,
        last_error=None,
        approved_by=None,
        published_at=None,
    )


@pytest.mark.asyncio
async def test_image_generation_disabled_skips_kie_and_sets_ready(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    item = _text_ready_item()
    kie_mock = MagicMock()
    kie_mock.generate_image = AsyncMock(
        side_effect=AssertionError("KIE must not be called")
    )

    update_status_mock = AsyncMock()
    update_image_mock = AsyncMock()
    monkeypatch.setattr(
        image_generator_module, "update_item_status", update_status_mock
    )
    monkeypatch.setattr(
        image_generator_module, "update_item_image", update_image_mock
    )

    settings = MagicMock()
    settings.image_generation_enabled = False

    outcome = await generate_image_for_item(
        pool=MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        item=item,
        settings=settings,
        kie=kie_mock,
    )

    assert outcome.skipped is True
    assert outcome.image_url == ""
    update_status_mock.assert_awaited_once()
    assert update_status_mock.await_args.kwargs == {
        "item_id": item.id,
        "status": "ready",
    }
    update_image_mock.assert_not_awaited()
    kie_mock.generate_image.assert_not_called()


@pytest.mark.asyncio
async def test_image_generation_enabled_calls_kie(monkeypatch: pytest.MonkeyPatch) -> None:
    item = _text_ready_item()
    kie_result = MagicMock()
    kie_result.image_url = "https://example.com/img.jpg"
    kie_result.task_id = "task-1"
    kie_result.model = "flux"
    kie_result.latency_ms = 100
    kie_result.dry_run = False
    kie_result.raw_response = {}

    kie_mock = MagicMock()
    kie_mock.generate_image = AsyncMock(return_value=kie_result)

    monkeypatch.setattr(image_generator_module, "log_prompt", AsyncMock())
    monkeypatch.setattr(image_generator_module, "log_integration", AsyncMock())
    update_image_mock = AsyncMock()
    monkeypatch.setattr(
        image_generator_module, "update_item_image", update_image_mock
    )

    settings = MagicMock()
    settings.image_generation_enabled = True
    settings.image_backup_enabled = False
    settings.kie_model = "flux-kontext-pro"

    outcome = await generate_image_for_item(
        pool=MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        item=item,
        settings=settings,
        kie=kie_mock,
    )

    assert outcome.skipped is False
    assert outcome.image_url == "https://example.com/img.jpg"
    kie_mock.generate_image.assert_awaited_once()
    update_image_mock.assert_awaited_once()
