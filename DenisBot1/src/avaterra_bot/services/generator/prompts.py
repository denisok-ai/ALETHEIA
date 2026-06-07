"""
@file: prompts.py
@description: 7 шаблонов промптов AVATERRA на базе knowledge/avaterra.yaml + промпт картинки
@dependencies: avaterra_bot.db.repositories.brand
@created: 2026-05-07
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from avaterra_bot.db.repositories.brand import BrandProfile


COMMON_RULES_RU = (
    "Общие правила:\n"
    "- Пиши на русском, простыми человеческими словами.\n"
    "- Без воды, штампов, эзотерики и агрессивных продаж.\n"
    "- Без эмодзи, без хэштегов, без английских слов кроме явных терминов "
    "(Avaterra, FAQ, CTA, Telegram).\n"
    "- Уважительный тон, обращение на 'вы'.\n"
    "- Не давай медицинских обещаний, не ставь диагнозы, не отменяй врачей.\n"
    "- Не сравнивайся с другими школами и экспертами.\n"
    "- Не раскрывай платные пошаговые протоколы курса; говори общо."
)

DEFAULT_LENGTH_WINDOWS: dict[str, tuple[int, int]] = {
    "educational": (1200, 1800),
    "pain": (1000, 1500),
    "practice": (700, 1100),
    "author": (900, 1400),
    "faq": (800, 1300),
    "course": (1500, 2400),
    "reflection": (600, 1100),
    "info": (1500, 2400),
    "sales": (1500, 2400),
}


@dataclass(frozen=True)
class GenerationRequest:
    post_type: str
    topic: str
    objective: str
    outline: str
    cta: str
    audience_id: Optional[str] = None
    rubric_id: Optional[str] = None
    feedback: Optional[str] = None


def _length_window(brand: BrandProfile, post_type: str) -> tuple[int, int]:
    for tpl in brand.templates or []:
        if tpl.get("id") == post_type:
            length = tpl.get("length") or {}
            mn = length.get("min")
            mx = length.get("max")
            if isinstance(mn, int) and isinstance(mx, int) and mx > mn:
                return mn, mx
    return DEFAULT_LENGTH_WINDOWS.get(post_type, (1200, 2000))


def _structure_steps(brand: BrandProfile, post_type: str) -> list[str]:
    for tpl in brand.templates or []:
        if tpl.get("id") == post_type:
            steps = tpl.get("structure") or []
            if steps:
                return list(steps)
    return [
        "Зацепка",
        "Основная мысль",
        "Связь с методом AVATERRA",
        "Мягкий CTA",
    ]


def _audience_block(brand: BrandProfile, audience_id: Optional[str]) -> str:
    if not audience_id:
        return ""
    for aud in brand.audiences or []:
        if aud.get("id") == audience_id:
            pains = "; ".join(aud.get("pains") or [])
            search = "; ".join(aud.get("search") or [])
            angle = aud.get("angle") or ""
            return (
                f"Аудитория: {aud.get('name', audience_id)}.\n"
                f"Боли: {pains}.\n"
                f"Что ищет: {search}.\n"
                f"Ракурс подачи: {angle}."
            )
    return ""


def _resolve_audience_id(
    brand: BrandProfile, post_type: str, requested: Optional[str]
) -> Optional[str]:
    if requested:
        return requested
    for tpl in brand.templates or []:
        if tpl.get("id") == post_type:
            return tpl.get("default_audience")
    return None


def _disclaimer_required(brand: BrandProfile, topic: str) -> bool:
    triggers = (brand.disclaimer or {}).get("triggers") or []
    if not triggers:
        return False
    haystack = topic.lower()
    return any(trigger.lower() in haystack for trigger in triggers)


def _disclaimer_text(brand: BrandProfile) -> str:
    return ((brand.disclaimer or {}).get("text") or "").strip()


def _quick_links_block(brand: BrandProfile) -> str:
    links = brand.quick_links or {}
    if not links:
        return ""
    pairs = []
    if links.get("course_body"):
        pairs.append(f"курс «Тело не врёт»: {links['course_body']}")
    if links.get("course_awakening"):
        pairs.append(f"курс «Пробуждение»: {links['course_awakening']}")
    if links.get("faq"):
        pairs.append(f"FAQ: {links['faq']}")
    if links.get("catalog"):
        pairs.append(f"каталог: {links['catalog']}")
    return "Полезные ссылки школы: " + "; ".join(pairs) + "."


def _author_block(brand: BrandProfile) -> str:
    author = brand.author or {}
    name = author.get("name")
    facts = author.get("facts") or []
    if not name:
        return ""
    facts_part = " ".join(f"- {f}" for f in facts[:3])
    return f"Об авторе ({name}): {facts_part}"


def _product_block(brand: BrandProfile, post_type: str) -> str:
    products = brand.products or {}
    if post_type == "course":
        body = products.get("body_does_not_lie") or {}
        awa = products.get("awakening") or {}
        return (
            "Продуктовые опоры:\n"
            f"- {body.get('name', 'Тело не врёт')}: {body.get('short', '')} "
            f"({body.get('url', '')})\n"
            f"- {awa.get('name', 'Пробуждение')}: {awa.get('short', '')} "
            f"({awa.get('url', '')})"
        )
    return ""


def _sanitize_phrase(phrase: str) -> str:
    return re.sub(r"\s+", " ", phrase).strip()


def _prohibited_block(brand: BrandProfile) -> str:
    items = brand.prohibited_phrases or []
    if not items:
        return ""
    sample = "; ".join(_sanitize_phrase(p) for p in items[:8])
    return (
        f"Запрещённые фразы (не использовать ни в каком виде): {sample}. "
        "Если хочется сказать что-то близкое — переформулируй мягче."
    )


def _safe_replacements_block(brand: BrandProfile) -> str:
    rep = brand.safe_replacements or {}
    if not rep:
        return ""
    pairs = "; ".join(f"«{k}» → «{v}»" for k, v in list(rep.items())[:6])
    return f"Безопасные замены: {pairs}."


def _allowed_links_block(brand: BrandProfile) -> str:
    """Whitelist URL для модели (защита от галлюцинаций ссылок)."""
    urls: list[str] = []
    for product in (brand.products or {}).values():
        if isinstance(product, dict) and product.get("url"):
            urls.append(product["url"])
    for url in (brand.quick_links or {}).values():
        if url and url.startswith("http"):
            urls.append(url)
    deduped = sorted({u.rstrip("/") for u in urls})
    if not deduped:
        return ""
    listed = "\n".join(f"- {u}" for u in deduped)
    return (
        "СТРОГО ПО ССЫЛКАМ. Используй ТОЛЬКО эти URL школы:\n"
        f"{listed}\n"
        "Запрещено выдумывать или менять любые URL (включая /store, /shop, /catalog "
        "и любые другие пути). Если подходящей ссылки нет — лучше вообще не вставляй URL "
        "и закончи текст мягким вопросом или CTA без ссылки."
    )


def build_text_prompts(
    *, brand: BrandProfile, request: GenerationRequest
) -> tuple[str, str]:
    """Вернуть (system_prompt, user_prompt) для DeepSeek."""
    structure_steps = _structure_steps(brand, request.post_type)
    structure_block = "Структура поста:\n" + "\n".join(
        f"{i + 1}) {step}" for i, step in enumerate(structure_steps)
    )
    length_min, length_max = _length_window(brand, request.post_type)
    audience_id = _resolve_audience_id(brand, request.post_type, request.audience_id)
    audience_block = _audience_block(brand, audience_id)
    needs_disclaimer = _disclaimer_required(brand, request.topic)
    disclaimer_text = _disclaimer_text(brand) if needs_disclaimer else ""
    quick_links = _quick_links_block(brand)
    author_block = _author_block(brand) if request.post_type == "author" else ""
    product_block = _product_block(brand, request.post_type)
    prohibited_block = _prohibited_block(brand)
    replacements_block = _safe_replacements_block(brand)
    allowed_links_block = _allowed_links_block(brand)

    system_lines = [
        "Ты - редактор Telegram-канала AVATERRA (avaterra.pro).",
        "Школа учит мышечному тестированию и осознанной работе с телом.",
        "AVATERRA не лечит и не ставит диагнозов: мы работаем со стрессом, "
        "эмоциональными причинами и телесным откликом.",
        f"Tone of Voice: {brand.tone_of_voice}",
        COMMON_RULES_RU,
        f"Длина текста: {length_min}-{length_max} знаков, абзацы по 2-4 предложения.",
        structure_block,
    ]
    if audience_block:
        system_lines.append(audience_block)
    if author_block:
        system_lines.append(author_block)
    if product_block:
        system_lines.append(product_block)
    if prohibited_block:
        system_lines.append(prohibited_block)
    if replacements_block:
        system_lines.append(replacements_block)
    if allowed_links_block:
        system_lines.append(allowed_links_block)
    if needs_disclaimer and disclaimer_text:
        system_lines.append(
            "Перед CTA добавь короткий мягкий дисклеймер своими словами на основе фразы: "
            f"\"{disclaimer_text}\""
        )
    if quick_links:
        system_lines.append(quick_links)

    system_prompt = "\n\n".join(system_lines)

    user_lines = [
        f"Тип поста: {request.post_type}",
        f"Тема: {request.topic}",
        f"Цель: {request.objective}",
        f"План (можно переосмыслить, но соблюдай структуру): {request.outline}",
        f"CTA-якорь: {request.cta}",
    ]
    if request.feedback:
        user_lines.append(
            "Замечания по предыдущей попытке (исправь их полностью):\n"
            + request.feedback
        )
    user_lines.append(
        "Верни только готовый текст поста без служебных заголовков "
        "вроде 'Заголовок:' / 'Текст:'. Текст должен быть готов к публикации."
    )
    return system_prompt, "\n".join(user_lines)


def build_image_prompt(*, request: GenerationRequest) -> str:
    """Промпт для KIE - фото без текста, в стилистике AVATERRA."""
    base_style = (
        "Cinematic editorial photo, soft natural light, calm composition, "
        "neutral palette (terracotta, sand, warm beige, sage), shallow depth of field, "
        "tactile materials (linen, ceramic, raw wood), subtle film grain, "
        "no text, no letters, no logos, no watermarks, no captions, "
        "no UI overlays, no faces, no children, no copyrighted artwork."
    )
    scenes = {
        "educational": (
            "Conceptual scene about awareness and listening to the body: "
            "warm interior with soft focus, plant leaves catching light, "
            "hands holding a stone, breath visible in cool air, abstract waves."
        ),
        "pain": (
            "Honest, gentle still-life of inner tiredness softening: "
            "a cup of warm tea on a linen cloth, a window with morning light, "
            "a slow exhale captured as steam over a ceramic bowl."
        ),
        "practice": (
            "Quiet practice moment: an open palm resting on the chest area, "
            "a notebook with a single line drawn, a glass of water beside, "
            "soft daylight, no faces."
        ),
        "author": (
            "Workspace of an experienced practitioner: a wooden desk, an open book, "
            "a candle, a ceramic mug, a folded scarf, soft window light, no faces."
        ),
        "faq": (
            "Calm symbolic still-life of clarity: a single key on linen, "
            "a smooth stone next to a small mirror reflecting soft light, "
            "minimal composition, lots of negative space."
        ),
        "course": (
            "Symbolic environment of beginning a practice: an open notebook with empty page, "
            "a ceramic bowl with water, soft morning light, a folded blanket, "
            "earthy palette, lots of negative space."
        ),
        "reflection": (
            "Quiet end-of-week scene: a single candle, a window with evening light, "
            "a folded linen shawl, a tea cup, soft shadows, calm mood."
        ),
    }
    scene = scenes.get(request.post_type, scenes["educational"])
    return f"{scene} {base_style}"
