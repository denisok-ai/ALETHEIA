"""
@file: normalizer.py
@description: Нормализация HTML страниц - удаление шума и извлечение значимых блоков
@dependencies: beautifulsoup4, lxml
@created: 2026-05-07
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable

from bs4 import BeautifulSoup, Tag

NOISE_TAGS = (
    "script",
    "style",
    "noscript",
    "header",
    "footer",
    "nav",
    "aside",
    "iframe",
    "form",
    "template",
    "svg",
)
NOISE_CLASS_HINTS = (
    "cookie",
    "consent",
    "banner",
    "navbar",
    "menu",
    "footer",
    "header",
    "sidebar",
    "social",
    "popup",
    "modal",
    "toast",
    "notification",
    "subscribe-form",
    "newsletter",
    "promo",
    "countdown",
    "ticker",
)
NOISE_ID_HINTS = NOISE_CLASS_HINTS

PRICE_RE = re.compile(r"(\d[\d\s.,]*)\s*(₽|руб(?:лей|\.|))", re.IGNORECASE)
TIMER_RE = re.compile(r"\b\d{1,2}:\d{2}(:\d{2})?\b")
DATE_RE = re.compile(
    r"\b\d{1,2}\s+(янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)[а-я]*\.?\s*\d{0,4}\b",
    re.IGNORECASE,
)
COUNTDOWN_RE = re.compile(
    r"\b(осталось|до конца|акция|ещё)\s+\d+\s+(дн|ч|мин|сек)[а-я]*", re.IGNORECASE
)
WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class ContentBlock:
    """Очищенный смысловой блок страницы."""

    block_type: str
    block_key: str
    text: str
    hash: str
    payload: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "block_type": self.block_type,
            "block_key": self.block_key,
            "text": self.text,
            "hash": self.hash,
            "payload": self.payload,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ContentBlock":
        return cls(
            block_type=data["block_type"],
            block_key=data["block_key"],
            text=data["text"],
            hash=data["hash"],
            payload=dict(data.get("payload") or {}),
        )


@dataclass
class NormalizedPage:
    """Полный результат нормализации одной страницы."""

    title: str
    meta_description: str
    cleaned_text: str
    blocks: list[ContentBlock]
    content_hash: bytes

    def to_storage(self) -> dict:
        return {
            "title": self.title,
            "meta_description": self.meta_description,
            "cleaned_text": self.cleaned_text,
            "blocks": [b.to_dict() for b in self.blocks],
        }


def _strip_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = TIMER_RE.sub(" ", text)
    text = DATE_RE.sub(" ", text)
    text = COUNTDOWN_RE.sub(" ", text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    return text


def _hash_text(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _is_noise(tag: Tag) -> bool:
    if not isinstance(tag, Tag):
        return False
    if tag.name in NOISE_TAGS:
        return True
    if not getattr(tag, "attrs", None):
        return False
    class_attr = tag.attrs.get("class") or []
    if isinstance(class_attr, str):
        class_attr = [class_attr]
    classes = " ".join(str(c) for c in class_attr).lower()
    tag_id = str(tag.attrs.get("id") or "").lower()
    role = str(tag.attrs.get("role") or "").lower()
    if any(hint in classes for hint in NOISE_CLASS_HINTS):
        return True
    if any(hint in tag_id for hint in NOISE_ID_HINTS):
        return True
    if role in {"banner", "navigation", "contentinfo", "complementary"}:
        return True
    return False


def _collect_headings(soup: BeautifulSoup) -> Iterable[ContentBlock]:
    seen: set[str] = set()
    for level in (1, 2, 3):
        for index, h in enumerate(soup.find_all(f"h{level}")):
            text = _strip_text(h.get_text(" "))
            if not text or text in seen:
                continue
            seen.add(text)
            key = f"h{level}:{index}:{_hash_text(text)[:8]}"
            yield ContentBlock(
                block_type=f"heading_h{level}",
                block_key=key,
                text=text,
                hash=_hash_text(text),
            )


def _collect_meta(soup: BeautifulSoup) -> tuple[str, str, list[ContentBlock]]:
    title_tag = soup.find("title")
    title = _strip_text(title_tag.get_text(" ")) if title_tag else ""

    desc_tag = soup.find("meta", attrs={"name": "description"})
    if not desc_tag:
        desc_tag = soup.find("meta", attrs={"property": "og:description"})
    description = ""
    if desc_tag and desc_tag.get("content"):
        description = _strip_text(desc_tag.get("content"))

    blocks: list[ContentBlock] = []
    if title:
        blocks.append(
            ContentBlock(
                block_type="meta_title",
                block_key="meta:title",
                text=title,
                hash=_hash_text(title),
            )
        )
    if description:
        blocks.append(
            ContentBlock(
                block_type="meta_description",
                block_key="meta:description",
                text=description,
                hash=_hash_text(description),
            )
        )
    return title, description, blocks


def _collect_sections(soup: BeautifulSoup) -> Iterable[ContentBlock]:
    seen_hashes: set[str] = set()
    candidates: list[Tag] = []
    candidates.extend(soup.find_all("section"))
    candidates.extend(soup.find_all("article"))
    main = soup.find("main")
    if main:
        candidates.extend(main.find_all(["div"], recursive=False))
    for index, tag in enumerate(candidates):
        if _is_noise(tag):
            continue
        text = _strip_text(tag.get_text(" "))
        if len(text) < 80:
            continue
        h = _hash_text(text)
        if h in seen_hashes:
            continue
        seen_hashes.add(h)
        first_heading = tag.find(["h1", "h2", "h3"])
        anchor = (
            _strip_text(first_heading.get_text(" "))
            if first_heading
            else text[:60]
        )
        key_anchor = anchor[:80] or f"sec:{index}"
        yield ContentBlock(
            block_type="section",
            block_key=f"section:{key_anchor}",
            text=text,
            hash=h,
            payload={"length": len(text)},
        )


def _collect_prices(soup: BeautifulSoup, full_text: str) -> Iterable[ContentBlock]:
    matches = []
    for match in PRICE_RE.finditer(full_text):
        price_text = match.group(0)
        normalized = WHITESPACE_RE.sub(" ", price_text).strip()
        matches.append(normalized)
    deduped: list[str] = []
    for m in matches:
        if m not in deduped:
            deduped.append(m)
    for index, value in enumerate(deduped):
        yield ContentBlock(
            block_type="price",
            block_key=f"price:{index}",
            text=value,
            hash=_hash_text(value),
        )


CTA_MARKERS = (
    "записать",
    "запишись",
    "оставить заявку",
    "узнать подробнее",
    "купить",
    "оплатить",
    "присоединиться",
    "получить доступ",
    "записаться",
    "забронировать",
)


def _looks_like_cta_text(text: str) -> bool:
    text_lower = text.lower()
    return any(marker in text_lower for marker in CTA_MARKERS)


def _collect_cta(soup: BeautifulSoup) -> Iterable[ContentBlock]:
    seen: set[str] = set()
    candidates: list[Tag] = []
    candidates.extend(soup.find_all(["a", "button"]))
    for cls_marker in ("cta", "btn-primary", "button-primary"):
        candidates.extend(soup.find_all(class_=lambda c: bool(c) and cls_marker in str(c).lower()))
    for index, tag in enumerate(candidates):
        text = _strip_text(tag.get_text(" "))
        if not text or text in seen or not _looks_like_cta_text(text):
            continue
        seen.add(text)
        yield ContentBlock(
            block_type="cta",
            block_key=f"cta:{index}:{_hash_text(text)[:8]}",
            text=text,
            hash=_hash_text(text),
        )


def _collect_faq(soup: BeautifulSoup) -> Iterable[ContentBlock]:
    seen: set[str] = set()
    nodes = soup.find_all(attrs={"itemtype": re.compile("FAQPage|Question", re.I)})
    for node in nodes:
        text = _strip_text(node.get_text(" "))
        if not text or text in seen:
            continue
        seen.add(text)
        yield ContentBlock(
            block_type="faq",
            block_key=f"faq:{_hash_text(text)[:8]}",
            text=text,
            hash=_hash_text(text),
        )
    for details in soup.find_all("details"):
        text = _strip_text(details.get_text(" "))
        if not text or text in seen or len(text) < 20:
            continue
        seen.add(text)
        yield ContentBlock(
            block_type="faq",
            block_key=f"faq:{_hash_text(text)[:8]}",
            text=text,
            hash=_hash_text(text),
        )


def _remove_noise(soup: BeautifulSoup) -> None:
    to_remove: list[Tag] = []
    for tag in soup.find_all(True):
        try:
            if _is_noise(tag):
                to_remove.append(tag)
        except Exception:
            continue
    for tag in to_remove:
        try:
            tag.decompose()
        except Exception:
            continue


def normalize_html(html: str) -> NormalizedPage:
    """Превратить сырой HTML в нормализованный набор блоков."""
    soup = BeautifulSoup(html or "", "lxml")
    title, description, meta_blocks = _collect_meta(soup)

    body = soup.body or soup
    _remove_noise(body)

    blocks: list[ContentBlock] = list(meta_blocks)
    blocks.extend(list(_collect_headings(body)))
    blocks.extend(list(_collect_sections(body)))
    cleaned_text = _strip_text(body.get_text(" "))
    blocks.extend(list(_collect_prices(body, cleaned_text)))
    blocks.extend(list(_collect_cta(body)))
    blocks.extend(list(_collect_faq(body)))

    deduped: list[ContentBlock] = []
    seen: set[tuple[str, str]] = set()
    for block in blocks:
        signature = (block.block_type, block.hash)
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(block)

    digest = hashlib.sha256(cleaned_text.encode("utf-8")).digest()
    return NormalizedPage(
        title=title,
        meta_description=description,
        cleaned_text=cleaned_text,
        blocks=deduped,
        content_hash=digest,
    )
