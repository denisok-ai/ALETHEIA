"""
@file: test_site_radar_strategist.py
@description: Юнит-тесты strategist Site Radar — соответствие 7 post_types AVATERRA
@dependencies: avaterra_bot.services.site_radar.strategist, scorer
@created: 2026-05-07
"""

from __future__ import annotations

import pytest

from avaterra_bot.services.site_radar.scorer import ScoredSignal
from avaterra_bot.services.site_radar.strategist import build_theme

ALLOWED_POST_TYPES = {
    "educational",
    "pain",
    "practice",
    "author",
    "faq",
    "course",
    "reflection",
    # Сохраняем info/sales как fallback, но новые сигналы должны идти в новые типы.
    "info",
    "sales",
}


def _signal(signal_type: str, change_type: str, score: int = 60) -> ScoredSignal:
    severity = "high" if score >= 60 else ("medium" if score >= 30 else "low")
    return ScoredSignal(
        signal_type=signal_type,
        change_type=change_type,
        score=score,
        severity=severity,
        summary="Курс по работе с травмой",
        payload={},
    )


@pytest.mark.parametrize(
    "category,signal_type,change_type,expected_post_type",
    [
        ("course", "new_url", "new_url", "course"),
        ("blog_post", "new_url", "new_url", "educational"),
        ("faq", "new_url", "new_url", "faq"),
        ("home", "new_url", "new_url", "author"),
        ("course", "page_change", "price_changed", "course"),
        ("course", "page_change", "cta_changed", "course"),
        ("blog_post", "page_change", "updated_block", "educational"),
        ("faq", "page_change", "new_block", "faq"),
    ],
)
def test_radar_theme_uses_avaterra_post_types(
    category: str,
    signal_type: str,
    change_type: str,
    expected_post_type: str,
) -> None:
    signal = _signal(signal_type, change_type, score=70)
    theme = build_theme(signal, category)

    assert theme.post_type == expected_post_type
    assert theme.post_type in ALLOWED_POST_TYPES
    assert theme.audience is not None and theme.audience
    assert theme.rubric is not None and theme.rubric
    assert 1 <= theme.priority <= 100
