"""
@file: test_lexicon_normalization.py
@description: Тесты detereministic-нормализации лексики постов перед публикацией
@dependencies: services.quality.gates
@created: 2026-05-13
"""

from __future__ import annotations

from avaterra_bot.services.quality.gates import normalize_post_lexicon


def test_replaces_latin_brand_in_plain_text() -> None:
    text = "Школа Avaterra учит мышечному тестированию."
    assert "Avaterra" not in normalize_post_lexicon(text)
    assert "Аватэрра" in normalize_post_lexicon(text)


def test_keeps_avaterra_inside_url() -> None:
    text = "Подробнее на https://avaterra.pro/faq"
    out = normalize_post_lexicon(text)
    assert "https://avaterra.pro/faq" in out


def test_keeps_avaterra_inside_email() -> None:
    text = "Поддержка: support@avaterra.pro"
    out = normalize_post_lexicon(text)
    assert "support@avaterra.pro" in out


def test_replaces_calibration_inflections() -> None:
    text = (
        "Начните с короткой калибровки, потом перейдите к калибровке внимания. "
        "Иногда полезно калибровать каждую реакцию."
    )
    out = normalize_post_lexicon(text)
    assert "калибр" not in out.lower()
    assert "замер" in out.lower() or "сверить" in out.lower()


def test_does_not_touch_method_word() -> None:
    """«метод» намеренно не нормализуется — посты должны падать в гейте method_word."""
    text = "Наш метод помогает услышать тело."
    out = normalize_post_lexicon(text)
    assert "метод" in out


def test_idempotent_when_text_already_clean() -> None:
    text = "Школа Аватэрра. Замер через баланс тела."
    assert normalize_post_lexicon(text) == text


def test_empty_input_passthrough() -> None:
    assert normalize_post_lexicon("") == ""
