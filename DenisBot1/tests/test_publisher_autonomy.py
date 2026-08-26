"""
@file: test_publisher_autonomy.py
@description: Юнит-тесты автономного слоя публикатора (env-reconcile, парсинг bool)
@dependencies: avaterra_bot.workers.content_worker
@created: 2026-05-18
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import pytest

from avaterra_bot.workers.content_worker import (
    _env_bool,
    _reconcile_publisher_flags,
)


@dataclass
class _FakeSettings:
    dry_run: bool = False
    enable_auto_publish: bool = True


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("DRY_RUN", raising=False)
    monkeypatch.delenv("ENABLE_AUTO_PUBLISH", raising=False)
    yield


def test_env_bool_returns_default_when_not_set() -> None:
    assert _env_bool("MISSING_FLAG", default=True) is True
    assert _env_bool("MISSING_FLAG", default=False) is False


def test_env_bool_recognises_truthy_values(monkeypatch: pytest.MonkeyPatch) -> None:
    for raw in ("true", "True", "TRUE", "1", "yes", "on", "  Yes  "):
        monkeypatch.setenv("FLAG_X", raw)
        assert _env_bool("FLAG_X", default=False) is True, raw


def test_env_bool_recognises_falsy_values(monkeypatch: pytest.MonkeyPatch) -> None:
    for raw in ("false", "0", "no", "off", "", "  "):
        monkeypatch.setenv("FLAG_X", raw)
        assert _env_bool("FLAG_X", default=True) is False, raw


def test_reconcile_returns_empty_when_no_drift(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DRY_RUN", "false")
    monkeypatch.setenv("ENABLE_AUTO_PUBLISH", "true")
    settings = _FakeSettings(dry_run=False, enable_auto_publish=True)
    assert _reconcile_publisher_flags(settings) == {}
    assert settings.dry_run is False
    assert settings.enable_auto_publish is True


def test_reconcile_reverts_silent_dry_run_toggle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DRY_RUN", "false")
    monkeypatch.setenv("ENABLE_AUTO_PUBLISH", "true")
    settings = _FakeSettings(dry_run=True, enable_auto_publish=True)
    drift = _reconcile_publisher_flags(settings)
    assert drift == {"dry_run": {"runtime": True, "env": False}}
    assert settings.dry_run is False
    assert settings.enable_auto_publish is True


def test_reconcile_reverts_disabled_auto_publish(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DRY_RUN", "false")
    monkeypatch.setenv("ENABLE_AUTO_PUBLISH", "true")
    settings = _FakeSettings(dry_run=False, enable_auto_publish=False)
    drift = _reconcile_publisher_flags(settings)
    assert drift == {
        "enable_auto_publish": {"runtime": False, "env": True}
    }
    assert settings.enable_auto_publish is True


def test_reconcile_reports_both_drifts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DRY_RUN", "false")
    monkeypatch.setenv("ENABLE_AUTO_PUBLISH", "true")
    settings = _FakeSettings(dry_run=True, enable_auto_publish=False)
    drift = _reconcile_publisher_flags(settings)
    assert set(drift.keys()) == {"dry_run", "enable_auto_publish"}
    assert settings.dry_run is False
    assert settings.enable_auto_publish is True


def test_reconcile_respects_env_when_admin_wants_dry_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DRY_RUN", "true")
    monkeypatch.setenv("ENABLE_AUTO_PUBLISH", "true")
    settings = _FakeSettings(dry_run=False, enable_auto_publish=True)
    drift = _reconcile_publisher_flags(settings)
    assert drift == {"dry_run": {"runtime": False, "env": True}}
    assert settings.dry_run is True


def test_reconcile_uses_settings_when_env_absent() -> None:
    assert "DRY_RUN" not in os.environ
    assert "ENABLE_AUTO_PUBLISH" not in os.environ
    settings = _FakeSettings(dry_run=True, enable_auto_publish=False)
    drift = _reconcile_publisher_flags(settings)
    assert drift == {}
    assert settings.dry_run is True
    assert settings.enable_auto_publish is False
