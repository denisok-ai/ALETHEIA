"""
@file: test_publisher_dry_run_reasons.py
@description: Тесты функции `_dry_run_reasons` — почему публикатор уходит в dry-run путь
@dependencies: avaterra_bot.services.publisher.channel_publisher
@created: 2026-05-18
"""

from __future__ import annotations

from dataclasses import dataclass

from avaterra_bot.services.publisher.channel_publisher import (
    _dry_run_reasons,
    today_in_timezone,
)


@dataclass
class _FakeSettings:
    dry_run: bool = False
    enable_auto_publish: bool = True
    target_channel_id: str = "-1001234567890"


def test_reasons_empty_when_publish_ready() -> None:
    assert _dry_run_reasons(_FakeSettings()) == []


def test_reason_dry_run_flag() -> None:
    settings = _FakeSettings(dry_run=True)
    assert _dry_run_reasons(settings) == ["dry_run_flag"]


def test_reason_auto_publish_disabled() -> None:
    settings = _FakeSettings(enable_auto_publish=False)
    assert _dry_run_reasons(settings) == ["auto_publish_disabled"]


def test_reason_no_channel() -> None:
    settings = _FakeSettings(target_channel_id="")
    assert _dry_run_reasons(settings) == ["no_channel"]


def test_reason_blank_channel_treated_as_missing() -> None:
    settings = _FakeSettings(target_channel_id="   ")
    assert _dry_run_reasons(settings) == ["no_channel"]


def test_reasons_combine_multiple_causes() -> None:
    settings = _FakeSettings(
        dry_run=True, enable_auto_publish=False, target_channel_id=""
    )
    assert _dry_run_reasons(settings) == [
        "dry_run_flag",
        "auto_publish_disabled",
        "no_channel",
    ]


def test_today_in_timezone_returns_valid_date() -> None:
    today = today_in_timezone("Europe/Moscow")
    assert today.year >= 2026


def test_today_in_timezone_fallback_on_bad_zone() -> None:
    today = today_in_timezone("Mars/Olympus")
    assert today.year >= 2026
