"""
@file: test_publisher_text_split.py
@description: Юнит-тесты разбиения текста публикатора на Telegram-чанки до 4096 символов
@dependencies: avaterra_bot.services.publisher.channel_publisher._split_text_for_telegram
@created: 2026-05-07
"""

from __future__ import annotations

from avaterra_bot.services.publisher.channel_publisher import (
    _effective_photo_to_text_delay,
    _split_text_for_telegram,
)


def test_short_text_returns_single_chunk() -> None:
    text = "Короткий пост на пару строк.\n\nС одним абзацем."
    chunks = _split_text_for_telegram(text)
    assert chunks == [text]


def test_empty_text_returns_empty_list() -> None:
    assert _split_text_for_telegram("") == []
    assert _split_text_for_telegram("   \n\n  ") == []


def test_paragraph_boundary_split_preserves_paragraphs() -> None:
    paragraph = "А" * 2000
    text = paragraph + "\n\n" + paragraph + "\n\n" + paragraph
    chunks = _split_text_for_telegram(text, limit=4096)

    assert all(len(c) <= 4096 for c in chunks)
    assert len(chunks) >= 2
    joined = "\n\n".join(chunks)
    assert paragraph in chunks[0]
    assert paragraph in joined


def test_oversized_paragraph_is_split_by_chars() -> None:
    huge = "Б" * 10000
    chunks = _split_text_for_telegram(huge, limit=4096)

    assert all(len(c) <= 4096 for c in chunks)
    assert sum(len(c) for c in chunks) == 10000


def test_typical_post_within_4096_stays_single_message() -> None:
    text = "\n\n".join(["Абзац номер %d." % i for i in range(50)])
    chunks = _split_text_for_telegram(text)

    assert len(chunks) == 1
    assert chunks[0] == text


def test_photo_to_text_delay_has_floor_10_seconds() -> None:
    assert _effective_photo_to_text_delay(0) == 10.0
    assert _effective_photo_to_text_delay(5) == 10.0
    assert _effective_photo_to_text_delay(9.99) == 10.0
    assert _effective_photo_to_text_delay(-2) == 10.0


def test_photo_to_text_delay_keeps_large_value() -> None:
    assert _effective_photo_to_text_delay(10) == 10.0
    assert _effective_photo_to_text_delay(12.5) == 12.5
    assert _effective_photo_to_text_delay(20) == 20.0
