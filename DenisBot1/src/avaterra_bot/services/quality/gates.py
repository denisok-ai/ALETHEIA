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


def _strip_urls_and_emails(text: str) -> str:
    """Убрать URL и email, чтобы latin/brand гейты не цепляли домены."""
    stripped = _URL_PATTERN.sub(" ", text)
    stripped = re.sub(r"\bavaterra\.pro\b\S*", " ", stripped, flags=re.IGNORECASE)
    stripped = _URL_OR_EMAIL_TOKEN_PATTERN.sub(" ", stripped)
    return stripped


def _check_latin_words(
    text: str, brand: BrandProfile
) -> Optional[QualityIssue]:
    whitelist = set(brand.text_whitelist or []) | DEFAULT_WHITELIST
    haystack = _strip_urls_and_emails(text)
    found: list[str] = []
    for token in re.findall(r"[A-Za-z][A-Za-z\-]{1,}", haystack):
        if token in whitelist:
            continue
        if token.lower() in {item.lower() for item in whitelist}:
            continue
        if re.match(r"^https?$", token, flags=re.IGNORECASE):
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
        suggestion=(
            "добавь ссылку на курс, раздел «Описание» или каталог либо мягкий "
            "вопрос подписчикам"
        ),
    )


_FAQ_ACRONYM_PATTERN = re.compile(r"\bFAQ\b")
_CALIBRATION_PATTERN = re.compile(r"калибр", re.IGNORECASE)
_METHOD_WORD_PATTERN = re.compile(
    # Все падежные формы слова «метод» (м.р., 2-е скл.) — ед. и мн. число.
    # `\b` справа отсекает «методика», «методический», «методолог», «методист»:
    # после стема + опционального падежного окончания должна быть граница слова,
    # иначе следующая буква делает совпадение неполным и regex не срабатывает.
    r"\bметод(?:а|у|ом|е|ы|ов|ам|ами|ах)?\b",
    re.IGNORECASE,
)
_LATIN_BRAND_PATTERN = re.compile(r"\b[Aa][Vv][Aa][Tt][Ee][Rr][Rr][Aa]\b")


def _check_no_faq_acronym(text: str) -> Optional[QualityIssue]:
    """В тексте поста запрещён акроним 'FAQ' — пишем 'Описание'."""
    if not _FAQ_ACRONYM_PATTERN.search(text):
        return None
    return QualityIssue(
        code="faq_acronym",
        message="в тексте есть акроним «FAQ»",
        suggestion=(
            "замени на «раздел Описание» или «раздел с ответами на частые вопросы»; "
            "ссылку https://avaterra.pro/faq оставлять можно"
        ),
    )


def _check_no_calibration(text: str) -> Optional[QualityIssue]:
    """Любое слово на 'калибр…' запрещено — заменяем на формулировки про баланс."""
    if not _CALIBRATION_PATTERN.search(text):
        return None
    return QualityIssue(
        code="calibration_word",
        message="в тексте есть запрещённое слово из семейства «калибр…»",
        suggestion=(
            "перепиши через «замер через баланс тела», «сверить ответ с балансом» "
            "или «проверить ответ через баланс»"
        ),
    )


def _check_no_method_word(text: str) -> Optional[QualityIssue]:
    """Целое слово «метод» в тексте поста запрещено. Слово «методика» допустимо."""
    if not _METHOD_WORD_PATTERN.search(text):
        return None
    return QualityIssue(
        code="method_word",
        message="в тексте есть запрещённое слово «метод»",
        suggestion=(
            "замени на «школу Аватэрра», «подход школы Аватэрра» или «практику школы»;"
            " слово «методика» использовать можно"
        ),
    )


def _check_latin_brand(text: str) -> Optional[QualityIssue]:
    """В теле поста имя школы должно быть кириллицей: 'Аватэрра'.

    Латинская запись допускается только внутри URL/доменов avaterra.pro —
    URL мы вырезаем перед проверкой, чтобы они не давали ложноположительный
    срабатывание гейта.
    """
    stripped = _URL_PATTERN.sub(" ", text)
    stripped = re.sub(r"\bavaterra\.pro\b\S*", " ", stripped, flags=re.IGNORECASE)
    if not _LATIN_BRAND_PATTERN.search(stripped):
        return None
    return QualityIssue(
        code="latin_brand",
        message="название школы написано латиницей",
        suggestion="замени «Avaterra»/«AVATERRA» на «Аватэрра»",
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


_URL_OR_EMAIL_TOKEN_PATTERN = re.compile(
    r"(https?://\S+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})",
    re.IGNORECASE,
)


_DEFAULT_LEXICON_REPLACEMENTS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bAVATERRA\b"), "Аватэрра"),
    (re.compile(r"\bAvaterra\b"), "Аватэрра"),
    (re.compile(r"калибровкой", re.IGNORECASE), "замером через баланс тела"),
    (re.compile(r"калибровке", re.IGNORECASE), "замере через баланс тела"),
    (re.compile(r"калибровку", re.IGNORECASE), "замер через баланс тела"),
    (re.compile(r"калибровки", re.IGNORECASE), "замера через баланс тела"),
    (re.compile(r"калибровка", re.IGNORECASE), "замер через баланс тела"),
    (re.compile(r"калибровать", re.IGNORECASE), "сверить ответ с балансом"),
    (re.compile(r"калибруем", re.IGNORECASE), "сверяем с балансом"),
    (re.compile(r"калибруют", re.IGNORECASE), "сверяют с балансом"),
    (re.compile(r"калибруется", re.IGNORECASE), "сверяется с балансом"),
)


def normalize_post_lexicon(text: str) -> str:
    """Безопасные детерминированные замены лексики перед публикацией.

    - Латиница `Avaterra/AVATERRA` → `Аватэрра` (только в обычном тексте, URL и
      email сохраняем как есть).
    - Известные формы «калибровка/калибровать» → «замер через баланс тела» /
      «сверить ответ с балансом» (без согласования падежей — только частые формы).

    Слово «метод» намеренно НЕ нормализуем: без согласования падежей замена
    звучит коряво. Такие посты должны падать в `method_word` и перегенерироваться.
    """
    if not text:
        return text

    parts = _URL_OR_EMAIL_TOKEN_PATTERN.split(text)
    out: list[str] = []
    for chunk in parts:
        if not chunk:
            out.append(chunk)
            continue
        if _URL_OR_EMAIL_TOKEN_PATTERN.fullmatch(chunk):
            out.append(chunk)
            continue
        normalized = chunk
        for pattern, replacement in _DEFAULT_LEXICON_REPLACEMENTS:
            normalized = pattern.sub(replacement, normalized)
        out.append(normalized)
    return "".join(out)


def scan_publish_blockers(text: str) -> list[QualityIssue]:
    """Подмножество quality-гейтов, которые НИКОГДА не должны попасть в канал.

    Запускается публикатором уже на этапе отправки — это вторая линия защиты
    от случая «правила обновились после генерации, в БД лежит ready-пост со
    старого свода». Brand profile сюда не нужен — все проверки опираются на
    жёстко зашитые паттерны (FAQ, «калибр…», «метод» во всех падежах,
    латиница Avaterra вне URL).
    """
    issues: list[QualityIssue] = []
    for check in (
        _check_no_faq_acronym(text),
        _check_no_calibration(text),
        _check_no_method_word(text),
        _check_latin_brand(text),
    ):
        if check is not None:
            issues.append(check)
    return issues


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
        _check_no_faq_acronym(text),
        _check_no_calibration(text),
        _check_no_method_word(text),
        _check_latin_brand(text),
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


def _preferred_cta(brand: BrandProfile) -> str:
    library = brand.cta_library or {}
    options = library.get("soft") or library.get("course_body") or []
    if options:
        return str(options[0]).strip()
    return "Если тема откликнулась, сохраните пост и понаблюдайте за собой сегодня."


def _preferred_home_url(brand: BrandProfile) -> str:
    links = brand.quick_links or {}
    return (
        links.get("catalog")
        or links.get("home")
        or "https://avaterra.pro"
    )


def _canonical_url_for_path(path: str, brand: BrandProfile) -> str:
    links = brand.quick_links or {}
    lowered = path.lower()
    if "faq" in lowered:
        return links.get("faq") or "https://avaterra.pro/faq"
    if "probuzhd" in lowered or "awakening" in lowered:
        return links.get("course_awakening") or _preferred_home_url(brand)
    if "course" in lowered or "navyki" in lowered:
        return links.get("course_body") or _preferred_home_url(brand)
    return _preferred_home_url(brand)


def _rewrite_unknown_urls(text: str, brand: BrandProfile) -> str:
    """Заменить выдуманные URL бренда на ближайший whitelist."""
    allowed = _allowed_normalized(brand)
    hosts = {entry.split("/", 1)[0] for entry in allowed if entry}
    if not hosts:
        return text
    result = text
    for host in hosts:
        pattern = re.compile(
            _LEFT_BOUNDARY + re.escape(host) + _PATH_TAIL,
            re.IGNORECASE,
        )

        def _repl(match: re.Match[str], *, _host: str = host) -> str:
            raw = match.group(0)
            cleaned = _strip_scheme(raw)
            if cleaned in allowed:
                return raw
            path = cleaned.split("/", 1)[1] if "/" in cleaned else ""
            return _canonical_url_for_path(path, brand)

        result = pattern.sub(_repl, result)
    return result


def _trim_sentences(text: str, max_len: int) -> str:
    stripped = text.strip()
    if len(stripped) <= max_len:
        return stripped
    cut = stripped[:max_len]
    for sep in (". ", "! ", "? ", ".\n", "\n"):
        idx = cut.rfind(sep)
        if idx >= max(80, max_len // 3):
            return cut[: idx + 1].strip()
    return cut.rstrip()


def _trim_to_window(text: str, max_len: int) -> str:
    """Укоротить текст до max_len, по возможности сохранив последний абзац (CTA)."""
    stripped = text.strip()
    if len(stripped) <= max_len:
        return stripped
    parts = re.split(r"\n\n+", stripped)
    if len(parts) >= 2:
        tail = parts[-1].strip()
        head = "\n\n".join(parts[:-1]).strip()
        budget = max_len - len(tail) - 2
        if budget >= 200 and len(tail) < max_len // 2:
            return f"{_trim_sentences(head, budget)}\n\n{tail}".strip()
    return _trim_sentences(stripped, max_len)


def _append_block(text: str, block: str) -> str:
    block = block.strip()
    if not block:
        return text
    if block in text:
        return text
    return text.rstrip() + "\n\n" + block


def salvage_text(
    text: str,
    *,
    topic: str,
    post_type: str,
    brand: BrandProfile,
) -> tuple[str, QualityReport]:
    """Детерминированно починить то, что LLM стабильно промахивает.

    Чинит: лексику (Avaterra/калибр), FAQ, неизвестные URL, missing CTA,
    missing disclaimer, too_long. Не трогает «метод» (нужна перегенерация).
    """
    current = normalize_post_lexicon(text or "")
    current = _FAQ_ACRONYM_PATTERN.sub("раздел Описание", current)
    report = evaluate_text(
        text=current, topic=topic, post_type=post_type, brand=brand
    )
    for _ in range(3):
        if report.passed:
            return current, report
        codes = set(report.codes)
        nxt = current
        if "faq_acronym" in codes:
            nxt = _FAQ_ACRONYM_PATTERN.sub("раздел Описание", nxt)
        if "latin_brand" in codes or "calibration_word" in codes:
            nxt = normalize_post_lexicon(nxt)
        if "url_not_whitelisted" in codes:
            nxt = _rewrite_unknown_urls(nxt, brand)
        if "missing_disclaimer" in codes:
            disclaimer = ((brand.disclaimer or {}).get("text") or "").strip()
            if not disclaimer:
                disclaimer = (
                    "Это не замена врачу или психотерапевту: при острых "
                    "симптомах обратитесь к специалисту."
                )
            nxt = _append_block(nxt, disclaimer)
        if "missing_cta" in codes:
            home = _preferred_home_url(brand)
            nxt = _append_block(
                nxt, f"{_preferred_cta(brand)} Подробнее: {home}"
            )
        _, max_len = _length_window(brand, post_type)
        if "too_long" in codes or len(nxt.strip()) > max_len:
            nxt = _trim_to_window(nxt, max_len)
        if nxt == current:
            break
        current = nxt
        report = evaluate_text(
            text=current, topic=topic, post_type=post_type, brand=brand
        )
    return current, report
