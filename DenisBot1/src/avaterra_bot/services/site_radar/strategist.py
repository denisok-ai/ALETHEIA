"""
@file: strategist.py
@description: Преобразование сигналов Site Radar в идеи контента (theme_pool)
@dependencies: avaterra_bot.services.deduplication
@created: 2026-05-07
"""

from __future__ import annotations

from dataclasses import dataclass

from avaterra_bot.services.deduplication import (
    DuplicateChecker,
    HistoricalFingerprint,
    build_minhash,
    extract_keywords,
    fingerprint,
)
from avaterra_bot.services.site_radar.scorer import ScoredSignal


@dataclass(frozen=True)
class ThemeCandidate:
    """Идея контента, рожденная из сигнала."""

    topic: str
    angle: str
    post_type: str
    priority: int
    payload: dict
    audience: str | None = None
    rubric: str | None = None


def _topic_for_signal(
    signal: ScoredSignal, category: str
) -> tuple[str, str, str, str | None, str | None]:
    """Подобрать тему, ракурс, тип поста, аудиторию и рубрику для сигнала.

    Использует 7 типов AVATERRA из knowledge/avaterra.yaml.
    """
    change_type = signal.change_type
    summary = signal.summary or ""
    if signal.signal_type == "new_url":
        if category == "course":
            return (
                f"Новый курс на сайте: {summary}",
                "кому подойдёт, формат, мягкий CTA",
                "course",
                "personal_crisis",
                "soft_sales",
            )
        if category in {"blog_post", "blog_index"}:
            return (
                f"Новая статья: {summary}",
                "разбор пользы простыми словами",
                "educational",
                "tense_body",
                "body_speaks",
            )
        if category == "faq":
            return (
                f"Новые вопросы из FAQ: {summary}",
                "экспертный разбор возражения",
                "faq",
                "skeptics",
                "faq",
            )
        return (
            f"Новая страница на сайте: {summary}",
            "анонс с акцентом на бренд",
            "author",
            "specialists",
            "student_path",
        )
    if change_type == "price_changed":
        return (
            f"Обновление условий курса: {summary}",
            "что изменилось, кому это поможет, без давления",
            "course",
            "personal_crisis",
            "soft_sales",
        )
    if change_type == "cta_changed":
        return (
            f"Новый акцент в курсе: {summary}",
            "почему это важно, без обещаний",
            "course",
            "personal_crisis",
            "soft_sales",
        )
    if change_type in {"new_block", "updated_block"}:
        if category == "faq":
            return (
                f"Обновлён FAQ ({summary})",
                "ответ на возражение",
                "faq",
                "skeptics",
                "faq",
            )
        if category in {"blog_post", "blog_index"}:
            return (
                f"Обновление статьи: {summary}",
                "что нового и почему это важно",
                "educational",
                "tense_body",
                "body_speaks",
            )
        return (
            f"Обновление страницы ({category}): {summary}",
            "разбор изменения и польза",
            "educational",
            "tense_body",
            "body_speaks",
        )
    return (
        f"Изменение на странице ({category}): {summary}",
        "ситуативная заметка",
        "educational",
        "tense_body",
        "body_speaks",
    )


def build_theme(signal: ScoredSignal, category: str) -> ThemeCandidate:
    topic, angle, post_type, audience, rubric = _topic_for_signal(signal, category)
    priority = max(1, min(100, signal.score))
    payload = {
        "category": category,
        "summary": signal.summary,
        "change_type": signal.change_type,
        "score": signal.score,
        "severity": signal.severity,
    }
    return ThemeCandidate(
        topic=topic,
        angle=angle,
        post_type=post_type,
        priority=priority,
        payload=payload,
        audience=audience,
        rubric=rubric,
    )


def is_duplicate_topic(topic: str, recent_topics: list[str]) -> bool:
    """Проверка темы против последних тем через антидубль-механизм."""
    if not recent_topics:
        return False
    candidate = fingerprint(topic)
    history = [
        HistoricalFingerprint(
            reference_id=str(idx),
            minhash=build_minhash(t),
            keywords=tuple(extract_keywords(t)),
        )
        for idx, t in enumerate(recent_topics)
    ]
    checker = DuplicateChecker()
    return checker.check(candidate, history).is_duplicate
