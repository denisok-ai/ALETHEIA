"""
@file: test_site_radar_sitemap.py
@description: Тесты парсеров sitemap.xml и robots.txt
@dependencies: avaterra_bot.services.site_radar.sitemap
@created: 2026-05-07
"""

from __future__ import annotations

from avaterra_bot.services.site_radar.sitemap import (
    filter_entries_by_robots,
    normalize_sitemap_host,
    parse_robots,
    parse_sitemap,
)

SITEMAP_XML = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://avaterra.pro/</loc><priority>1</priority></url>
<url><loc>https://avaterra.pro/course/test</loc><changefreq>weekly</changefreq></url>
<url><loc>http://localhost:3000/blog</loc></url>
</urlset>
"""

ROBOTS = """
User-Agent: *
Allow: /
Disallow: /portal
Disallow: /api/
Sitemap: https://avaterra.pro/sitemap.xml
"""


def test_parse_sitemap_extracts_entries():
    entries = parse_sitemap(SITEMAP_XML)
    assert len(entries) == 3
    assert entries[0].loc == "https://avaterra.pro/"
    assert entries[1].changefreq == "weekly"


def test_normalize_sitemap_host_replaces_localhost():
    entries = parse_sitemap(SITEMAP_XML)
    normalized = normalize_sitemap_host(entries, "avaterra.pro")
    locs = [e.loc for e in normalized]
    assert all("localhost" not in url for url in locs)
    assert "https://avaterra.pro/blog" in locs


def test_parse_robots_basic():
    rules = parse_robots(ROBOTS)
    assert "/portal" in rules.disallow
    assert "/api/" in rules.disallow
    assert rules.is_allowed("/course/test")
    assert not rules.is_allowed("/portal")
    assert not rules.is_allowed("/api/")


def test_filter_entries_by_robots_drops_disallowed():
    entries = parse_sitemap(SITEMAP_XML)
    entries = normalize_sitemap_host(entries, "avaterra.pro")
    rules = parse_robots(ROBOTS)
    filtered = filter_entries_by_robots(entries, rules, "avaterra.pro")
    locs = [e.loc for e in filtered]
    assert "https://avaterra.pro/" in locs
    assert "https://avaterra.pro/course/test" in locs
    assert "https://avaterra.pro/blog" in locs
