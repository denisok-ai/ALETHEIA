"""
@file: gates.py
@description: Quality gates для постов AVATERRA: запрещённые фразы, латиница, длина, CTA, дисклеймер
@dependencies: avaterra_bot.db.repositories.brand
@created: 2026-05-07
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from avaterra_bot.db.repositories.brand import BrandProfile

logger = logging.getLogger(__name__)


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

DEFAULT_WHITELIST = {
    "Avaterra",
    "AVATERRA",
    "FAQ",
    "CTA",
    "Telegram",
    "VIP",
    "URL",
    "DM",
}

CTA_HINT_PATTERNS = (
    re.compile(r"https?://", re.IGNORECASE),
    re.compile(r"avaterra\.pro", re.IGNORECASE),
    re.compile(r"\bкурс[аеуы]?\b", re.IGNORECASE),
    re.compile(r"\b(?:сохраните|поделитесь|напишите|задайте)\b", re.IGNORECASE),
    re.compile(r"\bподробнее\b", re.IGNORECASE),
    re.compile(r"\b(?:программ[ау]|каталог)\b", re.IGNORECASE),
    re.compile(r"support@avaterra\.pro", re.IGNORECASE),
)


@dataclass
class QualityIssue:
    code: str
    message: str
    suggestion: str = ""


@dataclass
class QualityReport:
    passed: bool
    issues: list[QualityIssue] = field(default_factory=list)

    @property
    def codes(self) -> list[str]:
        return [issue.code for issue in self.issues]

    def feedback_for_retry(self) -> str:
        if not self.issues:
            return ""
        lines = ["Что нужно поправить в следующей версии:"]
        for issue in self.issues:
            line = f"- [{issue.code}] {issue.message}"
            if issue.suggestion:
                line += f" {issue.suggestion}"
            lines.append(line)
        return "\n".join(lines)


def _length_window(brand: BrandProfile, post_type: str) -> tuple[int, int]:
    for tpl in brand.templates or []:
        if tpl.get("id") == post_type:
            length = tpl.get("length") or {}
            mn = length.get("min")
            mx = length.get("max")
            if isinstance(mn, int) and isinstance(mx, int) and mx > mn:
                return mn, mx
    return DEFAULT_LENGTH_WINDOWS.get(post_type, (1200, 2000))


def _check_prohibited_phrases(
    text: str, brand: BrandProfile
) -> Optional[QualityIssue]:
    phrases = brand.prohibited_phrases or []
    for phrase in phrases:
        try:
            if re.search(phrase, text, flags=re.IGNORECASE):
                return QualityIssue(
                    code="prohibited_phrase",
                    message=f"в тексте найдена запрещённая формулировка: «{phrase}»",
                    suggestion=(
                        "переформулируй мягче, без обещаний лечения и гарантий"
                    ),
                )
        except re.error:
            if phrase.lower() in text.lower():
                return QualityIssue(
                    code="prohibited_phrase",
                    message=f"в тексте найдена запрещённая формулировка: «{phrase}»",
                )
    return None


def _check_latin_words(
    text: str, brand: BrandProfile
) -> Optional[QualityIssue]:
    whitelist = set(brand.text_whitelist or []) | DEFAULT_WHITELIST
    found: list[str] = []
    for token in re.findall(r"[A-Za-z][A-Za-z\-]{1,}", text):
        if token in whitelist:
            continue
        if token.lower() in {item.lower() for item in whitelist}:
            continue
        if re.match(r"^https?$", token, flags=re.IGNORECASE):
            continue
        if "avaterra.pro" in text.lower() and token.lower() in text.lower().split("/"):
            continue
        if any(token.lower() in url.lower() for url in (brand.quick_links or {}).values() if url):
            continue
        found.append(token)
    if not found:
        return None
    return QualityIssue(
        code="latin_word",
        message=(
            "найдены случайные латинские слова в русском тексте: "
            + ", ".join(sorted(set(found))[:5])
        ),
        suggestion="перепиши их на русском или удали",
    )


def _check_length(
    text: str, brand: BrandProfile, post_type: str
) -> Optional[QualityIssue]:
    min_len, max_len = _length_window(brand, post_type)
    length = len(text.strip())
    if length < min_len:
        return QualityIssue(
            code="too_short",
            message=f"текст {length} знаков, минимум для {post_type} - {min_len}",
            suggestion="добавь пример из практики или мягкую развёртку темы",
        )
    if length > max_len:
        return QualityIssue(
            code="too_long",
            message=f"текст {length} знаков, максимум для {post_type} - {max_len}",
            suggestion="сократи длинноты, убери повторы мысли",
        )
    return None


def _check_cta(text: str) -> Optional[QualityIssue]:
    for pattern in CTA_HINT_PATTERNS:
        if pattern.search(text):
            return None
    return QualityIssue(
        code="missing_cta",
        message="не нашёл понятный CTA в конце поста",
        suggestion="добавь ссылку на курс/FAQ/каталог или мягкий вопрос подписчикам",
    )


def _disclaimer_needed(topic: str, brand: BrandProfile) -> bool:
    triggers = (brand.disclaimer or {}).get("triggers") or []
    if not triggers:
        return False
    haystack = topic.lower()
    return any(trigger.lower() in haystack for trigger in triggers)


def _check_disclaimer(
    text: str, topic: str, brand: BrandProfile
) -> Optional[QualityIssue]:
    if not _disclaimer_needed(topic, brand):
        return None
    haystack = text.lower()
    markers = ("врач", "психотерапев", "не замен", "острых сим", "обратитесь")
    if any(marker in haystack for marker in markers):
        return None
    return QualityIssue(
        code="missing_disclaimer",
        message="тема медицинская/психо, но не вижу мягкого дисклеймера",
        suggestion="добавь короткую фразу, что это не замена врачу/психотерапевту",
    )


_URL_PATTERN = re.compile(r"https?://[^\s\)\]\}\>\,\;]+", re.IGNORECASE)
_PATH_TAIL = r"(?:/[^\s\)\]\}\>\,\;]*)?"
_LEFT_BOUNDARY = r"(?<![A-Za-z0-9.@\-])"


def _strip_scheme(value: str) -> str:
    """Убрать префикс схемы и привести к виду 'host[/path]'."""
    cleaned = value.strip().rstrip(".,;:!?)").lower()
    for prefix in ("https://", "http://"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix) :]
            break
    return cleaned.rstrip("/")


def _allowed_normalized(brand: BrandProfile) -> set[str]:
    """Whitelist в виде 'host' и 'host/path' (без схемы и слешей)."""
    allowed: set[str] = set()

    def _add(value: str | None) -> None:
        if not value:
            return
        cleaned = _strip_scheme(value)
        if cleaned:
            allowed.add(cleaned)

    for product in (brand.products or {}).values():
        if isinstance(product, dict):
            _add(product.get("url"))
    for variants in (brand.cta_library or {}).values():
        for variant in variants or []:
            for url in _URL_PATTERN.findall(variant or ""):
                _add(url)
    for url in (brand.quick_links or {}).values():
        _add(url)
    return allowed


def _check_urls(text: str, brand: BrandProfile) -> Optional[QualityIssue]:
    """Любая ссылка/упоминание домена бренда в тексте должна быть в whitelist.

    Telegram автодетектит домены даже без `https://`, поэтому проверяем не только
    явные URL, но и упоминания вида `host/path` без схемы.
    """
    allowed = _allowed_normalized(brand)
    if not allowed:
        return None

    hosts = {entry.split("/", 1)[0] for entry in allowed if entry}
    if not hosts:
        return None

    bad: list[str] = []
    seen: set[str] = set()
    for host in hosts:
        pattern = re.compile(
            _LEFT_BOUNDARY + re.escape(host) + _PATH_TAIL,
            re.IGNORECASE,
        )
        for match in pattern.finditer(text):
            raw = match.group(0)
            cleaned = _strip_scheme(raw)
            if cleaned in allowed:
                continue
            if cleaned in seen:
                continue
            seen.add(cleaned)
            bad.append(raw)

    if not bad:
        return None
    suggestion_links = ", ".join(sorted(allowed)[:3]) or "—"
    return QualityIssue(
        code="url_not_whitelisted",
        message=(
            "ссылки в тексте не из whitelist бренда: "
            + ", ".join(sorted(set(bad))[:3])
        ),
        suggestion=(
            "используй только официальные ссылки школы (например: "
            f"{suggestion_links}); не выдумывай URL и не сокращай схему"
        ),
    )


def evaluate_text(
    *,
    text: str,
    topic: str,
    post_type: str,
    brand: BrandProfile,
) -> QualityReport:
    issues: list[QualityIssue] = []
    for check in (
        _check_prohibited_phrases(text, brand),
        _check_latin_words(text, brand),
        _check_length(text, brand, post_type),
        _check_cta(text),
        _check_disclaimer(text, topic, brand),
        _check_urls(text, brand),
    ):
        if check is not None:
            issues.append(check)
    report = QualityReport(passed=not issues, issues=issues)
    if issues:
        logger.info(
            "quality_gate_failed",
            extra={
                "post_type": post_type,
                "issues": report.codes,
            },
        )
    return report
