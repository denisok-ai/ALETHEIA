"""
@file: sitemap.py
@description: Парсер sitemap.xml и robots.txt с учетом disallow-правил
@dependencies: lxml, urllib
@created: 2026-05-07
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse
from xml.etree import ElementTree as ET

SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


@dataclass(frozen=True)
class SitemapEntry:
    """Запись в sitemap."""

    loc: str
    lastmod: str | None = None
    changefreq: str | None = None
    priority: float | None = None


def parse_sitemap(xml_text: str) -> list[SitemapEntry]:
    """Распарсить sitemap.xml в список записей."""
    if not xml_text or not xml_text.strip():
        return []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return []

    entries: list[SitemapEntry] = []
    for url in root.findall(f"{SITEMAP_NS}url"):
        loc_node = url.find(f"{SITEMAP_NS}loc")
        if loc_node is None or not (loc_node.text or "").strip():
            continue
        priority_text = (
            url.findtext(f"{SITEMAP_NS}priority", default="").strip() or None
        )
        try:
            priority_value = float(priority_text) if priority_text else None
        except ValueError:
            priority_value = None
        entries.append(
            SitemapEntry(
                loc=loc_node.text.strip(),
                lastmod=url.findtext(f"{SITEMAP_NS}lastmod", default="").strip() or None,
                changefreq=url.findtext(f"{SITEMAP_NS}changefreq", default="").strip()
                or None,
                priority=priority_value,
            )
        )
    return entries


@dataclass(frozen=True)
class RobotsRules:
    """Правила robots.txt для одного User-Agent."""

    disallow: tuple[str, ...] = ()
    allow: tuple[str, ...] = ()
    sitemaps: tuple[str, ...] = ()
    crawl_delay: float | None = None

    def is_allowed(self, path: str) -> bool:
        """Простейшая проверка по самому длинному совпадающему правилу."""
        match_len = -1
        decision = True
        for rule in self.disallow:
            if rule and path.startswith(rule) and len(rule) > match_len:
                match_len = len(rule)
                decision = False
        for rule in self.allow:
            if rule and path.startswith(rule) and len(rule) > match_len:
                match_len = len(rule)
                decision = True
        return decision


def parse_robots(text: str) -> RobotsRules:
    """Очень компактный парсер robots.txt - только то, что нужно радару."""
    disallow: list[str] = []
    allow: list[str] = []
    sitemaps: list[str] = []
    crawl_delay: float | None = None
    current_agent: str | None = None
    if not text:
        return RobotsRules()
    for raw_line in text.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            current_agent = value.lower()
        elif key == "sitemap":
            sitemaps.append(value)
        elif current_agent in ("*", "avaterrasiteRadar/1.0", None):
            if key == "disallow":
                if value:
                    disallow.append(value)
            elif key == "allow":
                if value:
                    allow.append(value)
            elif key == "crawl-delay":
                try:
                    crawl_delay = float(value)
                except ValueError:
                    crawl_delay = None
    return RobotsRules(
        disallow=tuple(disallow),
        allow=tuple(allow),
        sitemaps=tuple(sitemaps),
        crawl_delay=crawl_delay,
    )


def filter_entries_by_robots(
    entries: list[SitemapEntry], robots: RobotsRules, host: str
) -> list[SitemapEntry]:
    """Отбросить URL, запрещенные robots.txt, и URL других хостов."""
    target_host = host.lower()
    result: list[SitemapEntry] = []
    for entry in entries:
        parsed = urlparse(entry.loc)
        if parsed.netloc.lower() != target_host:
            continue
        if not robots.is_allowed(parsed.path or "/"):
            continue
        result.append(entry)
    return result


def normalize_sitemap_host(entries: list[SitemapEntry], target_host: str) -> list[SitemapEntry]:
    """Заменить host у записей на целевой (бывают bug-ные sitemap с localhost)."""
    normalized: list[SitemapEntry] = []
    target = target_host.lower()
    for entry in entries:
        parsed = urlparse(entry.loc)
        if parsed.netloc.lower() == target:
            normalized.append(entry)
            continue
        rebuilt = urlunparse(
            (
                "https",
                target_host,
                parsed.path,
                parsed.params,
                parsed.query,
                parsed.fragment,
            )
        )
        normalized.append(
            SitemapEntry(
                loc=rebuilt,
                lastmod=entry.lastmod,
                changefreq=entry.changefreq,
                priority=entry.priority,
            )
        )
    return normalized
