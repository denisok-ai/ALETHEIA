"""
@file: test_deduplication.py
@description: Тесты модуля антидублей публикаций
@dependencies: src/avaterra_bot/services/deduplication.py
@created: 2026-05-07
"""

from __future__ import annotations

import pytest

from avaterra_bot.services.deduplication import (
    DuplicateChecker,
    HistoricalFingerprint,
    build_minhash,
    deserialize_minhash,
    extract_keywords,
    fingerprint,
    keyword_overlap,
    serialize_minhash,
)

POST_A = (
    "Курс по медитации помогает вернуть фокус и спокойствие. "
    "Мы разбираем дыхательные практики и осознанное внимание."
)
POST_A_REWORDED = (
    "Курс медитации возвращает спокойствие и фокус. "
    "Внутри - дыхательные практики и осознанное внимание."
)
POST_A_MINOR_EDIT = (
    "Курс по медитации помогает вернуть фокус и спокойствие! "
    "Мы разбираем дыхательные практики и осознанное внимание."
)
POST_B = (
    "Канал Аватэрра рассказывает о трансформации, духовном пути и работе "
    "со страхами. Делимся практиками для уверенности."
)


def test_keywords_are_meaningful():
    keywords = set(extract_keywords(POST_A))
    assert "медитации" in keywords or "медитация" in keywords
    assert "курс" in keywords
    assert "что" not in keywords


def test_minhash_jaccard_high_for_minor_edit():
    a = build_minhash(POST_A)
    b = build_minhash(POST_A_MINOR_EDIT)
    assert a.jaccard(b) >= 0.8


def test_minhash_jaccard_low_for_different_topics():
    a = build_minhash(POST_A)
    b = build_minhash(POST_B)
    assert a.jaccard(b) < 0.1


def test_keyword_overlap_basic():
    overlap_same = keyword_overlap(["медитация", "фокус"], ["медитация", "фокус"])
    assert overlap_same == pytest.approx(1.0)
    overlap_none = keyword_overlap(["медитация"], ["курс"])
    assert overlap_none == 0.0


def test_serialize_roundtrip_preserves_jaccard():
    a = build_minhash(POST_A)
    payload = serialize_minhash(a)
    restored = deserialize_minhash(payload)
    assert a.jaccard(restored) == pytest.approx(1.0)


def test_duplicate_checker_detects_minor_edit():
    fp = fingerprint(POST_A_MINOR_EDIT)
    history = [
        HistoricalFingerprint(
            reference_id="post-a",
            minhash=build_minhash(POST_A),
            keywords=tuple(extract_keywords(POST_A)),
        )
    ]
    checker = DuplicateChecker(jaccard_threshold=0.55, keyword_threshold=0.7)
    result = checker.check(fp, history)
    assert result.is_duplicate is True
    assert result.reason == "minhash_similarity"


def test_duplicate_checker_detects_paraphrase_via_keywords():
    fp = fingerprint(POST_A_REWORDED)
    history = [
        HistoricalFingerprint(
            reference_id="post-a",
            minhash=build_minhash(POST_A),
            keywords=tuple(extract_keywords(POST_A)),
        )
    ]
    checker = DuplicateChecker(jaccard_threshold=0.55, keyword_threshold=0.6)
    result = checker.check(fp, history)
    assert result.is_duplicate is True
    assert result.reason == "keyword_overlap"


def test_duplicate_checker_passes_unique_post():
    fp = fingerprint(POST_B)
    history = [
        HistoricalFingerprint(
            reference_id="post-a",
            minhash=build_minhash(POST_A),
            keywords=tuple(extract_keywords(POST_A)),
        )
    ]
    checker = DuplicateChecker()
    result = checker.check(fp, history)
    assert result.is_duplicate is False
