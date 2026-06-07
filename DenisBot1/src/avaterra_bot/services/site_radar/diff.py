"""
@file: diff.py
@description: Сравнение версий нормализованной страницы и классификация типов изменений
@dependencies: avaterra_bot.services.deduplication, avaterra_bot.services.site_radar.normalizer
@created: 2026-05-07
"""

from __future__ import annotations

from dataclasses import dataclass

from avaterra_bot.services.deduplication import extract_keywords, keyword_overlap
from avaterra_bot.services.site_radar.normalizer import ContentBlock

CHANGE_TYPES = (
    "new_block",
    "updated_block",
    "removed_block",
    "price_changed",
    "cta_changed",
    "meta_changed",
    "noise",
)


@dataclass(frozen=True)
class BlockChange:
    """Изменение одного смыслового блока между версиями."""

    change_type: str
    block_type: str
    block_key: str
    old_text: str | None
    new_text: str | None
    keyword_shift: float


@dataclass(frozen=True)
class PageDiff:
    """Полный набор изменений между двумя версиями страницы."""

    new_blocks: tuple[BlockChange, ...]
    updated_blocks: tuple[BlockChange, ...]
    removed_blocks: tuple[BlockChange, ...]
    keyword_shift: float
    has_changes: bool


def _looks_like_cta(block: ContentBlock) -> bool:
    text = block.text.lower()
    cta_markers = (
        "записать",
        "запишись",
        "оставить заявку",
        "узнать подробнее",
        "купить",
        "оплатить",
        "присоединиться",
        "получить доступ",
        "записаться",
    )
    return any(marker in text for marker in cta_markers)


def _classify_block_change(
    block_type: str, old: ContentBlock | None, new: ContentBlock | None
) -> str:
    candidate = new or old
    if candidate is None:
        return "noise"
    if candidate.block_type == "price":
        return "price_changed"
    if candidate.block_type == "cta" or _looks_like_cta(candidate):
        return "cta_changed"
    if candidate.block_type.startswith("meta_"):
        return "meta_changed"
    if old is None and new is not None:
        return "new_block"
    if old is not None and new is None:
        return "removed_block"
    return "updated_block"


def diff_versions(
    old_blocks: list[ContentBlock] | None, new_blocks: list[ContentBlock]
) -> PageDiff:
    """Сравнить два набора блоков и вернуть структурированный дифф."""
    old_blocks = old_blocks or []
    old_index: dict[str, ContentBlock] = {b.block_key: b for b in old_blocks}
    new_index: dict[str, ContentBlock] = {b.block_key: b for b in new_blocks}

    new_changes: list[BlockChange] = []
    updated_changes: list[BlockChange] = []
    removed_changes: list[BlockChange] = []

    for key, new_block in new_index.items():
        old_block = old_index.get(key)
        if old_block is None:
            change_type = _classify_block_change(new_block.block_type, None, new_block)
            new_changes.append(
                BlockChange(
                    change_type=change_type,
                    block_type=new_block.block_type,
                    block_key=key,
                    old_text=None,
                    new_text=new_block.text,
                    keyword_shift=1.0,
                )
            )
            continue
        if old_block.hash == new_block.hash:
            continue
        shift = 1.0 - keyword_overlap(
            extract_keywords(old_block.text), extract_keywords(new_block.text)
        )
        change_type = _classify_block_change(
            new_block.block_type, old_block, new_block
        )
        updated_changes.append(
            BlockChange(
                change_type=change_type,
                block_type=new_block.block_type,
                block_key=key,
                old_text=old_block.text,
                new_text=new_block.text,
                keyword_shift=shift,
            )
        )

    for key, old_block in old_index.items():
        if key in new_index:
            continue
        change_type = _classify_block_change(old_block.block_type, old_block, None)
        removed_changes.append(
            BlockChange(
                change_type=change_type,
                block_type=old_block.block_type,
                block_key=key,
                old_text=old_block.text,
                new_text=None,
                keyword_shift=1.0,
            )
        )

    if old_blocks:
        all_old_text = " ".join(b.text for b in old_blocks)
        all_new_text = " ".join(b.text for b in new_blocks)
        keyword_shift = 1.0 - keyword_overlap(
            extract_keywords(all_old_text), extract_keywords(all_new_text)
        )
    else:
        keyword_shift = 1.0

    has_changes = bool(new_changes or updated_changes or removed_changes)
    return PageDiff(
        new_blocks=tuple(new_changes),
        updated_blocks=tuple(updated_changes),
        removed_blocks=tuple(removed_changes),
        keyword_shift=keyword_shift,
        has_changes=has_changes,
    )
