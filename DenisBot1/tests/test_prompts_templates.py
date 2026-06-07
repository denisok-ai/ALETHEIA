"""
@file: test_prompts_templates.py
@description: Тесты 7 шаблонов промптов: structure, CTA, дисклеймер
@dependencies: services.generator.prompts
@created: 2026-05-07
"""

from __future__ import annotations

from pathlib import Path

import pytest

from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.services.generator.prompts import (
    GenerationRequest,
    build_image_prompt,
    build_text_prompts,
)
from avaterra_bot.services.knowledge.loader import load_yaml

KB_PATH = Path(__file__).resolve().parents[1] / "knowledge" / "avaterra.yaml"


@pytest.fixture()
def brand() -> BrandProfile:
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


@pytest.mark.parametrize(
    "post_type",
    ["educational", "pain", "practice", "author", "faq", "course", "reflection"],
)
def test_each_template_has_structure(brand: BrandProfile, post_type: str):
    request = GenerationRequest(
        post_type=post_type,
        topic="Тема для теста",
        objective="проверить структуру",
        outline="вступление -> основное -> CTA",
        cta="Ссылка на курс",
    )
    system_prompt, user_prompt = build_text_prompts(brand=brand, request=request)
    assert "Структура поста" in system_prompt
    assert "Avaterra" in system_prompt or "AVATERRA" in system_prompt
    assert post_type in user_prompt
    assert "не лечит" in system_prompt


def test_health_topic_includes_disclaimer_instruction(brand: BrandProfile):
    request = GenerationRequest(
        post_type="educational",
        topic="Постоянная боль в спине",
        objective="доверие",
        outline="вступление -> разбор -> CTA",
        cta="Сохраните пост",
    )
    system_prompt, _ = build_text_prompts(brand=brand, request=request)
    assert "дисклеймер" in system_prompt.lower() or "не замена" in system_prompt.lower()


def test_neutral_topic_skips_disclaimer(brand: BrandProfile):
    request = GenerationRequest(
        post_type="reflection",
        topic="Тихий вопрос на конец недели",
        objective="рефлексия",
        outline="спокойная сцена -> вопрос",
        cta="Поделитесь в комментариях",
    )
    system_prompt, _ = build_text_prompts(brand=brand, request=request)
    assert "дисклеймер" not in system_prompt.lower()


def test_course_template_includes_product_block(brand: BrandProfile):
    request = GenerationRequest(
        post_type="course",
        topic="Кому подойдёт курс",
        objective="продажа",
        outline="кому -> что освоит -> формат -> CTA",
        cta="Подробнее на сайте",
    )
    system_prompt, _ = build_text_prompts(brand=brand, request=request)
    assert "avaterra.pro/course" in system_prompt
    assert "Тело не врёт" in system_prompt or "Пробуждение" in system_prompt


def test_image_prompt_excludes_text_in_image():
    request = GenerationRequest(
        post_type="educational",
        topic="Тема",
        objective="-",
        outline="-",
        cta="-",
    )
    prompt = build_image_prompt(request=request)
    assert "no text" in prompt.lower()
    assert "no logos" in prompt.lower()
    assert "no watermarks" in prompt.lower()


def test_audience_block_uses_template_default(brand: BrandProfile):
    request = GenerationRequest(
        post_type="pain",
        topic="Я отдыхаю, но не восстанавливаюсь",
        objective="откликнуться болью",
        outline="ситуация -> эмпатия -> метод -> CTA",
        cta="Сохраните пост",
    )
    system_prompt, _ = build_text_prompts(brand=brand, request=request)
    assert "Аудитория:" in system_prompt
