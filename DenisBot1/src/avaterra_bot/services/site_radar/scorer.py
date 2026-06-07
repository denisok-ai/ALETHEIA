"""
@file: scorer.py
@description: Оценка значимости изменений Site Radar и распределение по severity
@dependencies: avaterra_bot.services.site_radar.diff, avaterra_bot.services.site_radar.categorizer
@created: 2026-05-07
"""

from __future__ import annotations

from dataclasses import dataclass

from avaterra_bot.services.site_radar.categorizer import is_commercial
from avaterra_bot.services.site_radar.diff import BlockChange, PageDiff

WEIGHTS_BY_CHANGE_TYPE = {
    "new_block": 25,
    "updated_block": 15,
    "removed_block": 12,
    "price_changed": 35,
    "cta_changed": 25,
    "meta_changed": 10,
    "noise": 0,
}
SEVERITY_THRESHOLDS = {"high": 60, "medium": 30}
COMMERCIAL_BONUS = 15
NEW_URL_SCORE = 50
NEW_COURSE_URL_SCORE = 80
NEW_BLOG_URL_SCORE = 35


@dataclass(frozen=True)
class ScoredSignal:
    """Сигнал с присвоенным score, severity и краткой подписью."""

    signal_type: str
    change_type: str
    score: int
    severity: str
    summary: str
    payload: dict


def _severity_for_score(score: int) -> str:
    if score >= SEVERITY_THRESHOLDS["high"]:
        return "high"
    if score >= SEVERITY_THRESHOLDS["medium"]:
        return "medium"
    return "low"


def score_block_change(change: BlockChange, category: str) -> ScoredSignal:
    """Превратить отдельный блочный change в оцененный сигнал."""
    base = WEIGHTS_BY_CHANGE_TYPE.get(change.change_type, 0)
    bonus = COMMERCIAL_BONUS if is_commercial(category) else 0
    shift_bonus = int(round(change.keyword_shift * 10))
    score = max(0, base + bonus + shift_bonus)
    severity = _severity_for_score(score)
    summary_text = (
        change.new_text or change.old_text or change.block_type or change.change_type
    )
    summary = (summary_text or "")[:200]
    payload = {
        "block_type": change.block_type,
        "block_key": change.block_key,
        "keyword_shift": round(change.keyword_shift, 3),
        "old_text": (change.old_text or "")[:500],
        "new_text": (change.new_text or "")[:500],
    }
    return ScoredSignal(
        signal_type="page_change",
        change_type=change.change_type,
        score=score,
        severity=severity,
        summary=summary,
        payload=payload,
    )


def score_new_url(url: str, category: str) -> ScoredSignal:
    """Сигнал появления нового URL в sitemap."""
    if category == "course":
        score = NEW_COURSE_URL_SCORE
    elif category in {"blog_post", "blog_index"}:
        score = NEW_BLOG_URL_SCORE
    elif category in {"home", "faq"}:
        score = 65
    else:
        score = NEW_URL_SCORE
    severity = _severity_for_score(score)
    payload = {"url": url, "category": category}
    return ScoredSignal(
        signal_type="new_url",
        change_type="new_url",
        score=score,
        severity=severity,
        summary=url,
        payload=payload,
    )


def score_removed_url(url: str, category: str) -> ScoredSignal:
    """Сигнал удаления URL из sitemap."""
    score = 30 if category in {"course", "home"} else 15
    return ScoredSignal(
        signal_type="removed_url",
        change_type="removed_url",
        score=score,
        severity=_severity_for_score(score),
        summary=url,
        payload={"url": url, "category": category},
    )


def score_page_diff(diff: PageDiff, category: str) -> list[ScoredSignal]:
    """Преобразовать дифф страницы в список оцененных сигналов."""
    signals: list[ScoredSignal] = []
    for change in (*diff.new_blocks, *diff.updated_blocks, *diff.removed_blocks):
        if change.change_type == "noise":
            continue
        signals.append(score_block_change(change, category))
    return [s for s in signals if s.score > 0]
