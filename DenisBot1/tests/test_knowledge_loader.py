"""
@file: test_knowledge_loader.py
@description: Тесты загрузки knowledge/avaterra.yaml в Brand Profile
@dependencies: services.knowledge.loader
@created: 2026-05-07
"""

from __future__ import annotations

from pathlib import Path

from avaterra_bot.services.knowledge.loader import (
    REQUIRED_TOP_KEYS,
    kb_version_from_payload,
    load_yaml,
)

KB_PATH = Path(__file__).resolve().parents[1] / "knowledge" / "avaterra.yaml"


def test_kb_yaml_exists():
    assert KB_PATH.exists(), f"knowledge file missing at {KB_PATH}"


def test_kb_yaml_has_required_sections():
    data = load_yaml(KB_PATH)
    for key in REQUIRED_TOP_KEYS:
        assert key in data, f"missing section: {key}"


def test_kb_yaml_post_types_match_seven_days():
    data = load_yaml(KB_PATH)
    post_types = {tpl["id"] for tpl in data["post_types"]}
    weekdays = {tpl["weekday"] for tpl in data["post_types"]}
    assert post_types == {
        "educational",
        "pain",
        "practice",
        "author",
        "faq",
        "course",
        "reflection",
    }
    assert weekdays == {
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    }


def test_kb_yaml_has_safety_blocks():
    data = load_yaml(KB_PATH)
    assert isinstance(data["prohibited_phrases"], list) and data["prohibited_phrases"]
    assert isinstance(data["safe_replacements"], dict) and data["safe_replacements"]
    disclaimer = data["disclaimer"]
    assert disclaimer.get("text")
    assert disclaimer.get("triggers")


def test_kb_version_is_stable_for_same_payload():
    data1 = load_yaml(KB_PATH)
    data2 = load_yaml(KB_PATH)
    assert kb_version_from_payload(data1) == kb_version_from_payload(data2)
