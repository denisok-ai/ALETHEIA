"""
@file: test_projects_url_normalization.py
@description: Тесты канонизации website_url и устойчивости к дубликатам строк projects
@dependencies: services not required, чистая функция
@created: 2026-05-12
"""

from __future__ import annotations

import pytest

from avaterra_bot.db.repositories.projects import normalize_website_url


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("https://avaterra.pro", "https://avaterra.pro/"),
        ("https://avaterra.pro/", "https://avaterra.pro/"),
        ("HTTPS://Avaterra.Pro/", "https://avaterra.pro/"),
        ("https://avaterra.pro/course/", "https://avaterra.pro/course/"),
        ("https://avaterra.pro/course", "https://avaterra.pro/course/"),
        ("  https://avaterra.pro  ", "https://avaterra.pro/"),
        ("avaterra.pro", "https://avaterra.pro/"),
        ("http://avaterra.pro", "http://avaterra.pro/"),
    ],
)
def test_normalize_website_url_handles_common_forms(raw: str, expected: str) -> None:
    assert normalize_website_url(raw) == expected


def test_normalize_website_url_idempotent() -> None:
    url = "https://avaterra.pro"
    canonical = normalize_website_url(url)
    assert normalize_website_url(canonical) == canonical


def test_normalize_website_url_empty_passthrough() -> None:
    assert normalize_website_url("") == ""
    assert normalize_website_url("   ") == ""
