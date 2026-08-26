"""
@file: test_quality_gates.py
@description: Тесты quality gates (запрет фраз, латиница, длина, CTA, дисклеймер)
@dependencies: services.quality.gates
@created: 2026-05-07
"""

from __future__ import annotations

from pathlib import Path

import pytest

from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.services.knowledge.loader import load_yaml
from avaterra_bot.services.quality.gates import evaluate_text, salvage_text, scan_publish_blockers

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
        "Мы в школе Аватэрра смотрим, что стоит за этим напряжением: эмоция, "
        "ситуация, привычная реакция. Мышечное тестирование — это спокойный "
        "способ задать телу понятный вопрос и услышать честный ответ через "
        "сверку баланса. Сегодня просто заметьте, где у вас живёт усталость. "
    )
    base = (body * 4).strip() + " "
    base += (
        "Если хотите глубже, программа курса: "
        "https://avaterra.pro/course/navyki-myshechnogo-testirovaniya"
    )
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
        "Мышечное тестирование помогает услышать честный ответ через сверку баланса. "
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
        "Тело часто реагирует раньше головы. Мышечное тестирование помогает "
        "услышать его честный ответ через сверку баланса. Мы в школе Аватэрра "
        "работаем со стрессом и телесным откликом, не лечим и не ставим диагнозов. "
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
        "Тело часто реагирует раньше головы. Мышечное тестирование помогает "
        "услышать его честный ответ через сверку баланса. Мы в школе Аватэрра "
        "работаем со стрессом и телесным откликом, не лечим и не ставим диагнозов. "
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
        "Тело часто реагирует раньше головы. Мышечное тестирование помогает "
        "услышать его честный ответ через сверку баланса. Мы в школе Аватэрра "
        "работаем со стрессом и телесным откликом, не лечим и не ставим диагнозов. "
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


def test_catches_faq_acronym():
    """В тексте поста запрещён акроним FAQ — должен быть гейт `faq_acronym`."""
    brand = _kb_brand()
    text = _good_post_text("Подробнее в FAQ на сайте.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "faq_acronym" in report.codes


def test_faq_url_does_not_trigger_acronym_gate():
    """Ссылка `/faq` не должна цеплять `faq_acronym` (там нет границ слова FAQ)."""
    brand = _kb_brand()
    text = _good_post_text(
        "Если остались вопросы — раздел Описание: https://avaterra.pro/faq"
    )
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "faq_acronym" not in report.codes


def test_catches_calibration_word():
    brand = _kb_brand()
    text = _good_post_text("Начните с короткой калибровки внимания.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "calibration_word" in report.codes


def test_catches_latin_brand_word():
    """Голое слово Avaterra (не в URL) должно ловиться отдельным гейтом."""
    brand = _kb_brand()
    text = _good_post_text("Школа Avaterra поможет разобраться.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "latin_brand" in report.codes


def test_catches_method_word():
    """Целое слово «метод» в тексте поста должно ловиться гейтом `method_word`."""
    brand = _kb_brand()
    text = _good_post_text(
        "Наш метод помогает услышать тело и работать со стрессом."
    )
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "method_word" in report.codes


def test_method_word_gate_allows_methodika():
    """Слово «методика» (производное) не должно цеплять `method_word`."""
    brand = _kb_brand()
    text = _good_post_text("Методика мышечного тестирования проста и бережна.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "method_word" not in report.codes


@pytest.mark.parametrize(
    "phrase",
    [
        "Наш метод помогает",
        "В методе Аватэрра мы исследуем",
        "Без метода ничего не получится",
        "Доверьтесь методу мягко",
        "Работаем методом мышечного теста",
        "Размышляем о методе и опыте",
        "Эти методы давно проверены",
        "Среди методов школы есть мягкие",
        "Учим методам школы",
        "Делимся методами школы",
        "В методах школы важно тело",
    ],
)
def test_method_word_gate_catches_all_inflections(phrase):
    """Все падежные формы «метод» (ед. и мн.) должны ловиться `method_word`."""
    brand = _kb_brand()
    text = _good_post_text(phrase + ".")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "method_word" in report.codes


@pytest.mark.parametrize(
    "phrase",
    [
        "Методика школы Аватэрра помогает",
        "В методике мышечного теста ключевая мысль — мягкость",
        "Методики бывают разные",
        "Методический подход важен",
        "Подходим методически и спокойно",
        "Наш методист объяснит на практике",
        "Методология школы Аватэрра — про баланс тела",
    ],
)
def test_method_word_gate_skips_derivatives(phrase):
    """Производные `методик-/методическ-/методист-/методолог-` остаются разрешены."""
    brand = _kb_brand()
    text = _good_post_text(phrase + ".")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "method_word" not in report.codes


def test_catches_calibration_derivative_word():
    """Любые производные от «калибр…» должны срабатывать (не только склонения)."""
    brand = _kb_brand()
    text = _good_post_text("В курсе мы используем калиброванный подход.")
    report = evaluate_text(
        text=text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert "calibration_word" in report.codes


def test_scan_publish_blockers_detects_method_inflection():
    """Публикаторский страховочный скан ловит «методе» так же, как gate."""
    issues = scan_publish_blockers(
        "В методе Аватэрра мы не работаем с диагнозами."
    )
    codes = {issue.code for issue in issues}
    assert "method_word" in codes


def test_scan_publish_blockers_passes_clean_text():
    """Чистый текст не должен генерировать blocker'ов."""
    issues = scan_publish_blockers(
        "В школе Аватэрра мы исследуем тело через мышечный тест."
    )
    assert issues == []


def test_scan_publish_blockers_catches_red_set():
    """Сразу несколько blocker'ов: FAQ, калибр, метод, латиница Avaterra."""
    text = (
        "Подробнее в FAQ. Начните с короткой калибровки внимания. "
        "В нашем методе главное — баланс. Школа Avaterra поможет."
    )
    issues = scan_publish_blockers(text)
    codes = {issue.code for issue in issues}
    assert codes == {"faq_acronym", "calibration_word", "method_word", "latin_brand"}


def test_salvage_adds_cta_and_rewrites_bad_url():
    brand = _kb_brand()
    body = (
        "Тело часто реагирует раньше головы. Мышечное тестирование помогает "
        "услышать его честный ответ через сверку баланса. Мы в школе Аватэрра "
        "работаем со стрессом и телесным откликом, не лечим и не ставим диагнозов. "
    ) * 8
    body += " Каталог: https://avaterra.pro/store"
    salvaged, report = salvage_text(
        body,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert report.passed, report.codes
    assert "avaterra.pro/store" not in salvaged
    assert "https://avaterra.pro" in salvaged


def test_salvage_trims_too_long_and_keeps_cta():
    brand = _kb_brand()
    body = (
        "Тело часто реагирует раньше, чем мы успеваем подумать. "
        "Если в плечах постоянно тяжесть, это может быть отклик на стресс. "
        "Мы в школе Аватэрра смотрим, что стоит за этим напряжением. "
    ) * 20
    body += "\n\nЕсли хотите глубже, программа курса: https://avaterra.pro/course/navyki-myshechnogo-testirovaniya"
    assert len(body) > 1800
    salvaged, report = salvage_text(
        body,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert report.passed, report.codes
    assert len(salvaged) <= 1800
    assert "avaterra.pro/course" in salvaged


def test_salvage_replaces_faq_acronym_and_latin_brand():
    brand = _kb_brand()
    text = _good_post_text("Подробнее в FAQ. Школа Avaterra рядом.")
    salvaged, report = salvage_text(
        text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert report.passed, report.codes
    assert "FAQ" not in salvaged
    assert "Avaterra" not in salvaged
    assert "Аватэрра" in salvaged


def test_salvage_does_not_auto_fix_method_word():
    brand = _kb_brand()
    text = _good_post_text("Наш метод помогает услышать тело.")
    salvaged, report = salvage_text(
        text,
        topic="Почему тело часто честнее головы",
        post_type="educational",
        brand=brand,
    )
    assert not report.passed
    assert "method_word" in report.codes
    assert "метод" in salvaged
