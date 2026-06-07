"""
@file: categorizer.py
@description: Категоризация URL по типу страницы (course/blog/faq/...)
@dependencies: urllib
@created: 2026-05-07
"""

from __future__ import annotations

from urllib.parse import urlparse

CATEGORIES = (
    "home",
    "course",
    "blog_index",
    "blog_post",
    "faq",
    "about",
    "legal",
    "contact",
    "other",
)

LEGAL_PATHS = {"/oferta", "/privacy", "/pd-consent", "/terms", "/cookie", "/policy"}
CONTACT_PATHS = {"/contacts", "/contact"}
ABOUT_PATHS = {"/about", "/about-us"}
FAQ_PATHS = {"/faq", "/help", "/qa"}
PRIORITY_BY_CATEGORY = {
    "home": 1.0,
    "course": 0.95,
    "faq": 0.7,
    "blog_index": 0.65,
    "blog_post": 0.6,
    "about": 0.4,
    "legal": 0.2,
    "contact": 0.3,
    "other": 0.5,
}


def categorize(url: str) -> str:
    """Определить категорию страницы по URL."""
    path = (urlparse(url).path or "/").rstrip("/") or "/"
    if path == "/":
        return "home"
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "home"
    head = "/" + parts[0]
    if head == "/course":
        return "course"
    if head == "/blog":
        return "blog_index" if len(parts) == 1 else "blog_post"
    if path in FAQ_PATHS or head in FAQ_PATHS:
        return "faq"
    if path in ABOUT_PATHS or head in ABOUT_PATHS:
        return "about"
    if path in CONTACT_PATHS or head in CONTACT_PATHS:
        return "contact"
    if path in LEGAL_PATHS or head in LEGAL_PATHS:
        return "legal"
    return "other"


def is_commercial(category: str) -> bool:
    """Коммерчески критичные категории - используются скорером значимости."""
    return category in {"home", "course", "faq"}
