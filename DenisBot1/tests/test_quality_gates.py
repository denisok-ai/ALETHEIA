"""
@file: test_quality_gates.py
@description: Тесты quality gates (запрет фраз, латиница, длина, CTA, дисклеймер)
@dependencies: services.quality.gates
@created: 2026-05-07
"""

from __future__ import annotations

from pathlib import Path

from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.services.knowledge.loader import load_yaml
from avaterra_bot.services.quality.gates import evaluate_text

KB_PATH = Path(__file__).resolve().parents[1] / "knowledge" / "avaterra.yaml"


def _kb_brand() -> BrandProfile:
    data = load_yaml(KB_PATH)
    audiences = list(data.get("audiences") or [])
    primary = audiences[0] if audiences else {}
    return BrandProfile(
        project_id="00000000-0000-0000-0000-000000000000",
        tone_of_voice=(data["brand"].get("tone_of_voice") or "").strip(),
        target_audience={
            "core": primary.get("name", ""),
            "pains": primary.get("pains") or [],
            "goals": primary.get("search") or [],
        },
        audiences=audiences,
        products=data.get("products") or {},
        author=data.get("author") or {},
        rubrics=data.get("rubrics") or [],
        templates=data.get("post_types") or [],
        cta_library=data.get("cta_library") or {},
        prohibited_phrases=data.get("prohibited_phrases") or [],
        safe_replacements=data.get("safe_replacements") or {},
        disclaimer=data.get("disclaimer") or {},
        quick_links=data.get("quick_links") or {},
        text_whitelist=data.get("text_whitelist_terms") or [],
    )


def _good_post_text(extra: str = "") -> str:
    body = (
        "Тело часто реагирует раньше, чем мы успеваем подумать. "
        "Если в плечах постоянно тяжесть, это может быть отклик на стресс. "
        "Мы в школе AVATERRA смотрим, что стоит за этим напряжением: эмоция, "
        "ситуация, привычная реакция. Метод мышечного тестирования — это спокойный "
        "способ задать телу понятный вопрос и услышать честный ответ. "
        "Сегодня просто заметьте, где у вас живёт усталость. "
    )
    base = (body * 4).strip() + " "
    base += "Если хотите глубже, программа курса: https://avaterra.pro/course/navyki-myshechnogo-testirovaniya"
    if extra:
        base += " " + extra
    return base


def test_passes_clean_post():
    brand = _kb_brand()
    text = _good_post_text()
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert report.passed, report.codes


def test_catches_prohibited_phrase():
    brand = _kb_brand()
    text = _good_post_text("Мы вылечим вашу боль за неделю.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "prohibited_phrase" in report.codes


def test_catches_random_latin_words():
    brand = _kb_brand()
    text = _good_post_text("This is some random english sentence inserted.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "latin_word" in report.codes


def test_catches_too_short():
    brand = _kb_brand()
    text = "Слишком короткий пост, недостаточно для educational." * 3
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "too_short" in report.codes


def test_catches_missing_cta():
    brand = _kb_brand()
    body = (
        "Тело часто реагирует раньше, чем мы успеваем подумать. "
        "Если в плечах тяжесть, это может быть телесный отклик на стресс. "
        "Метод мышечного тестирования помогает услышать честный ответ. "
    ) * 6
    report = evaluate_text(
        text=body.strip(),
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "missing_cta" in report.codes


def test_requires_disclaimer_for_health_topic():
    brand = _kb_brand()
    text = _good_post_text()
    report = evaluate_text(
        text=text,
        topic="Постоянная боль в спине: что стоит проверить",
        post_type="educational",
        brand=brand,
    )
    assert "missing_disclaimer" in report.codes


def test_catches_hallucinated_url():
    brand = _kb_brand()
    body = (
        "Тело часто реагирует раньше головы. Метод мышечного тестирования помогает "
        "услышать его честный ответ. Мы в школе AVATERRA работаем со стрессом и "
        "телесным откликом, не лечим и не ставим диагнозов. "
    ) * 5
    body += " Каталог программ: https://avaterra.pro/store"
    report = evaluate_text(
        text=body.strip(),
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "url_not_whitelisted" in report.codes


def test_whitelisted_url_passes():
    brand = _kb_brand()
    text = _good_post_text()
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "url_not_whitelisted" not in report.codes


def test_catches_bare_domain_without_scheme():
    """LLM может написать домен без https:// — Telegram всё равно сделает его кликабельным."""
    brand = _kb_brand()
    body = (
        "Тело часто реагирует раньше головы. Метод мышечного тестирования помогает "
        "услышать его честный ответ. Мы в школе AVATERRA работаем со стрессом и "
        "телесным откликом, не лечим и не ставим диагнозов. "
    ) * 5
    body += " Каталог программ: avaterra.pro/store"
    report = evaluate_text(
        text=body.strip(),
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "url_not_whitelisted" in report.codes


def test_bare_homepage_mention_passes():
    """Простое упоминание `avaterra.pro` (главная) не должно блокироваться."""
    brand = _kb_brand()
    text = _good_post_text("Школа: avaterra.pro.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "url_not_whitelisted" not in report.codes


def test_email_is_not_treated_as_url():
    """Email `support@avaterra.pro` не должен срабатывать как URL."""
    brand = _kb_brand()
    text = _good_post_text("Поддержка: support@avaterra.pro.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "url_not_whitelisted" not in report.codes


def test_http_scheme_blocked_when_only_https_whitelisted():
    """`http://avaterra.pro/store` тоже блокируется (несуществующий путь)."""
    brand = _kb_brand()
    body = (
        "Тело часто реагирует раньше головы. Метод мышечного тестирования помогает "
        "услышать его честный ответ. Мы в школе AVATERRA работаем со стрессом и "
        "телесным откликом, не лечим и не ставим диагнозов. "
    ) * 5
    body += " http://avaterra.pro/store"
    report = evaluate_text(
        text=body.strip(),
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "url_not_whitelisted" in report.codes


def test_disclaimer_satisfied_with_marker():
    brand = _kb_brand()
    text = (
        _good_post_text(
            "Это не замена врачу: при острых симптомах обратитесь к специалисту."
        )
    )
    report = evaluate_text(
        text=text,
        topic="Постоянная боль в спине: что стоит проверить",
        post_type="educational",
        brand=brand,
    )
    assert "missing_disclaimer" not in report.codes
