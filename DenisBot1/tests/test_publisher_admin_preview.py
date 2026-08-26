"""
@file: test_publisher_admin_preview.py
@description: Тесты режима PUBLISH_MODE=admin_preview
@dependencies: avaterra_bot.services.publisher.channel_publisher
@created: 2026-05-20
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from unittest.mock import AsyncMock, MagicMock

import pytest

from avaterra_bot.db.repositories.content import ContentItemRecord
from avaterra_bot.services.publisher import channel_publisher as publisher_module
from avaterra_bot.services.publisher.channel_publisher import (
    _dry_run_reasons,
    publish_item,
)


def _ready_item() -> ContentItemRecord:
    return ContentItemRecord(
        id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        plan_id="22222222-2222-2222-2222-222222222222",
        publish_date=date(2026, 5, 20),
        post_type="educational",
        topic="Тема поста",
        objective="доверие",
        outline="outline",
        cta="CTA",
        status="ready",
        generated_text="Текст для проверки админами.",
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


@dataclass
class _FakeSettings:
    dry_run: bool = True
    enable_auto_publish: bool = False
    target_channel_id: str = ""
    publish_mode: str = "admin_preview"
    timezone: str = "Europe/Moscow"
    admin_telegram_ids: str = "337952743,368722371,459494305"
    admin_preview_exclude_ids: str = "8660626182,7679088857"

    @property
    def is_admin_preview_mode(self) -> bool:
        return self.publish_mode.strip().lower() == "admin_preview"

    @property
    def admin_ids(self) -> set[int]:
        result: set[int] = set()
        for raw in self.admin_telegram_ids.split(","):
            raw = raw.strip()
            if raw.isdigit():
                result.add(int(raw))
        return result

    @property
    def admin_preview_exclude(self) -> set[int]:
        return {8660626182, 7679088857}

    @property
    def admin_preview_recipient_ids(self) -> set[int]:
        return self.admin_ids - self.admin_preview_exclude


@pytest.mark.asyncio
async def test_admin_preview_sends_to_all_admins_not_channel(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    item = _ready_item()
    settings = _FakeSettings()

    sent_messages: list[tuple[int, str]] = []

    async def _fake_send_message(*, chat_id: int, text: str, parse_mode=None):
        sent_messages.append((chat_id, text))
        msg = MagicMock()
        msg.message_id = 1000 + chat_id
        return msg

    bot = MagicMock()
    bot.send_message = AsyncMock(side_effect=_fake_send_message)
    bot.send_photo = AsyncMock(
        side_effect=AssertionError("send_photo must not be called")
    )

    update_status_mock = AsyncMock()
    log_integration_mock = AsyncMock()
    mark_theme_mock = AsyncMock()
    monkeypatch.setattr(
        publisher_module, "update_item_status", update_status_mock
    )
    monkeypatch.setattr(
        publisher_module, "log_integration", log_integration_mock
    )
    monkeypatch.setattr(
        publisher_module, "mark_theme_status", mark_theme_mock
    )
    monkeypatch.setattr(
        publisher_module, "scan_publish_blockers", lambda _text: []
    )
    monkeypatch.setattr(
        publisher_module,
        "today_in_timezone",
        lambda _tz: item.publish_date,
    )

    outcome = await publish_item(
        bot,
        MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        settings=settings,  # type: ignore[arg-type]
        item=item,
    )

    assert outcome.status == "admin_preview_sent"
    assert outcome.dry_run is False
    assert outcome.message_id is not None
    bot.send_photo.assert_not_called()
    assert len(sent_messages) == 3
    assert {chat_id for chat_id, _ in sent_messages} == settings.admin_preview_recipient_ids
    for _, text in sent_messages:
        assert "Пост на проверку" in text
        assert "Опубликуйте в канале" not in text
        assert "/stat" not in text
        assert "Текст для проверки админами." in text
    update_status_mock.assert_awaited_once()
    assert update_status_mock.await_args.kwargs["status"] == "admin_preview_sent"
    log_integration_mock.assert_awaited_once()
    assert log_integration_mock.await_args.kwargs["operation"] == "admin.preview"


@pytest.mark.asyncio
async def test_admin_preview_fails_without_admins(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    item = _ready_item()
    settings = _FakeSettings(admin_telegram_ids="")

    bot = MagicMock()
    bot.send_message = AsyncMock()
    update_status_mock = AsyncMock()
    monkeypatch.setattr(
        publisher_module, "update_item_status", update_status_mock
    )
    monkeypatch.setattr(
        publisher_module, "scan_publish_blockers", lambda _text: []
    )
    monkeypatch.setattr(
        publisher_module,
        "today_in_timezone",
        lambda _tz: item.publish_date,
    )

    outcome = await publish_item(
        bot,
        MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        settings=settings,  # type: ignore[arg-type]
        item=item,
    )

    assert outcome.status == "failed"
    assert outcome.error == "no_admins"
    bot.send_message.assert_not_called()
    update_status_mock.assert_awaited_once()
    assert update_status_mock.await_args.kwargs["last_error"] == "no_admins"


@pytest.mark.asyncio
async def test_admin_preview_skips_already_sent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    item = _ready_item()
    item.status = "admin_preview_sent"
    settings = _FakeSettings()
    bot = MagicMock()
    bot.send_message = AsyncMock(
        side_effect=AssertionError("must not send again")
    )
    monkeypatch.setattr(
        publisher_module, "scan_publish_blockers", lambda _text: []
    )
    monkeypatch.setattr(
        publisher_module,
        "today_in_timezone",
        lambda _tz: item.publish_date,
    )
    outcome = await publish_item(
        bot,
        MagicMock(),
        project_id="00000000-0000-0000-0000-000000000000",
        settings=settings,  # type: ignore[arg-type]
        item=item,
    )
    assert outcome.status == "admin_preview_sent"
    bot.send_message.assert_not_called()


@pytest.mark.asyncio
async def test_channel_mode_still_uses_dry_run_when_disabled() -> None:
    settings = _FakeSettings(
        publish_mode="channel",
        dry_run=True,
        enable_auto_publish=False,
        target_channel_id="-100123",
    )
    assert settings.is_admin_preview_mode is False
    assert _dry_run_reasons(settings) == [  # type: ignore[arg-type]
        "dry_run_flag",
        "auto_publish_disabled",
    ]
