"""
@file: test_site_radar_normalizer.py
@description: Тесты нормализатора HTML и устойчивости к шуму
@dependencies: avaterra_bot.services.site_radar.normalizer
@created: 2026-05-07
"""

from __future__ import annotations

from avaterra_bot.services.site_radar.normalizer import normalize_html

PAGE_BASE = """<!doctype html>
<html><head>
<title>Avaterra - курс мышечного тестирования</title>
<meta name="description" content="Авторский курс по работе с телом">
</head>
<body>
<header class="navbar"><a>Меню</a></header>
<nav><a>Навигация</a></nav>
<main>
<h1>Курс мышечного тестирования</h1>
<section>
<h2>Программа курса</h2>
<p>Полная методика мышечного тестирования включает дыхательные практики и работу с телом. Восемь модулей с практическими заданиями.</p>
</section>
<section class="cta-block">
<button>Записаться на курс</button>
</section>
<section>Цена: 19 990 ₽</section>
</main>
<aside class="banner">Скидка 50%! Осталось 3 дня</aside>
<footer>© Avaterra 2026</footer>
<script>console.log('analytics')</script>
</body></html>"""

PAGE_BASE_TIMER = PAGE_BASE.replace(
    "Полная методика",
    "12:34:56 Осталось 5 дней. Полная методика",
)
PAGE_WITH_TIMER = PAGE_BASE_TIMER.replace(
    "12:34:56 Осталось 5 дней",
    "11:00:00 Осталось 3 дня",
)

PAGE_PRICE_CHANGED = PAGE_BASE.replace("19 990 ₽", "24 990 ₽")


def test_normalizer_drops_nav_footer_scripts():
    page = normalize_html(PAGE_BASE)
    text = page.cleaned_text
    assert "Меню" not in text
    assert "Навигация" not in text
    assert "© Avaterra" not in text
    assert "Скидка" not in text
    assert "console.log" not in text
    assert "Программа курса" in text


def test_normalizer_extracts_meta_and_headings():
    page = normalize_html(PAGE_BASE)
    titles = [b for b in page.blocks if b.block_type == "meta_title"]
    descriptions = [b for b in page.blocks if b.block_type == "meta_description"]
    h1 = [b for b in page.blocks if b.block_type == "heading_h1"]
    assert titles and "Avaterra" in titles[0].text
    assert descriptions and descriptions[0].text
    assert h1 and "Курс мышечного тестирования" in h1[0].text


def test_normalizer_extracts_price_block():
    page = normalize_html(PAGE_BASE)
    prices = [b for b in page.blocks if b.block_type == "price"]
    assert prices, "expected price block"
    assert "19 990" in prices[0].text


def test_timer_text_does_not_change_content_hash():
    a = normalize_html(PAGE_BASE_TIMER)
    b = normalize_html(PAGE_WITH_TIMER)
    assert a.content_hash == b.content_hash, (
        "noise (timer/countdown) must not change content hash"
    )


def test_price_change_changes_blocks():
    a = normalize_html(PAGE_BASE)
    b = normalize_html(PAGE_PRICE_CHANGED)
    a_prices = [block.text for block in a.blocks if block.block_type == "price"]
    b_prices = [block.text for block in b.blocks if block.block_type == "price"]
    assert a_prices != b_prices
