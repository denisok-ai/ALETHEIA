"""
@file: test_site_radar_diff_scorer.py
@description: Тесты диффа блоков, классификатора и скорера значимости
@dependencies: avaterra_bot.services.site_radar.{diff,scorer,categorizer}
@created: 2026-05-07
"""

from __future__ import annotations

from avaterra_bot.services.site_radar.categorizer import categorize, is_commercial
from avaterra_bot.services.site_radar.diff import diff_versions
from avaterra_bot.services.site_radar.normalizer import normalize_html
from avaterra_bot.services.site_radar.scorer import (
    score_new_url,
    score_page_diff,
    score_removed_url,
)

PAGE_V1 = """<html><head><title>Курс</title></head><body><main>
<section><h2>Программа</h2><p>Полный курс мышечного тестирования с восемью модулями</p></section>
<section>Цена: 19 990 ₽</section>
</main></body></html>"""

PAGE_V2_PRICE = PAGE_V1.replace("19 990 ₽", "24 990 ₽")

PAGE_V2_NEW_BLOCK = PAGE_V1.replace(
    "</main>",
    "<section><h2>Бонусный модуль</h2><p>Новый бонусный модуль про работу со страхами и осознанностью добавлен в курс.</p></section></main>",
)

PAGE_V2_CTA = PAGE_V1.replace(
    "</main>",
    "<section><a>Записаться на курс прямо сейчас и получить разбор</a></section></main>",
)


def test_categorizer_detects_categories():
    assert categorize("https://avaterra.pro/") == "home"
    assert categorize("https://avaterra.pro/course/abc") == "course"
    assert categorize("https://avaterra.pro/blog") == "blog_index"
    assert categorize("https://avaterra.pro/blog/post-1") == "blog_post"
    assert categorize("https://avaterra.pro/faq") == "faq"
    assert categorize("https://avaterra.pro/oferta") == "legal"
    assert is_commercial("course") is True
    assert is_commercial("legal") is False


def test_diff_detects_price_change():
    a = normalize_html(PAGE_V1).blocks
    b = normalize_html(PAGE_V2_PRICE).blocks
    diff = diff_versions(a, b)
    assert diff.has_changes
    change_types = {c.change_type for c in (*diff.new_blocks, *diff.updated_blocks, *diff.removed_blocks)}
    assert "price_changed" in change_types


def test_diff_detects_new_block():
    a = normalize_html(PAGE_V1).blocks
    b = normalize_html(PAGE_V2_NEW_BLOCK).blocks
    diff = diff_versions(a, b)
    assert diff.has_changes
    assert any(c.change_type == "new_block" for c in diff.new_blocks)


def test_diff_detects_cta_change():
    a = normalize_html(PAGE_V1).blocks
    b = normalize_html(PAGE_V2_CTA).blocks
    diff = diff_versions(a, b)
    assert any(c.change_type == "cta_changed" for c in (*diff.new_blocks, *diff.updated_blocks))


def test_score_new_url_course_high():
    signal = score_new_url("https://avaterra.pro/course/new", "course")
    assert signal.severity == "high"
    assert signal.score >= 60


def test_score_removed_url_course_medium():
    signal = score_removed_url("https://avaterra.pro/course/old", "course")
    assert signal.severity in {"medium", "low"}


def test_score_page_diff_includes_commercial_bonus():
    a = normalize_html(PAGE_V1).blocks
    b = normalize_html(PAGE_V2_PRICE).blocks
    diff = diff_versions(a, b)
    signals_course = score_page_diff(diff, "course")
    signals_legal = score_page_diff(diff, "legal")
    max_course = max((s.score for s in signals_course), default=0)
    max_legal = max((s.score for s in signals_legal), default=0)
    assert max_course > max_legal
