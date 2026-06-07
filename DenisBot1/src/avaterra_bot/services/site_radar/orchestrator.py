"""
@file: orchestrator.py
@description: Полный цикл Site Radar - sitemap -> страницы -> сигналы -> темы -> уведомления
@dependencies: aiogram, asyncpg, avaterra_bot.services.site_radar.*
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

from aiogram import Bot

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.content import log_integration
from avaterra_bot.db.repositories.site_pages import (
    SitePageRecord,
    deactivate_pages,
    insert_version,
    latest_version,
    list_active_pages,
    touch_page_seen,
    upsert_page,
)
from avaterra_bot.db.repositories.site_signals import (
    SiteSignalRecord,
    insert_theme,
    mark_signal_status,
    recent_theme_topics,
    save_signal,
)
from avaterra_bot.services.site_radar.categorizer import categorize, is_commercial
from avaterra_bot.services.site_radar.diff import diff_versions
from avaterra_bot.services.site_radar.http_client import SiteRadarHttpClient
from avaterra_bot.services.site_radar.normalizer import normalize_html
from avaterra_bot.services.site_radar.notifier import notify_admins
from avaterra_bot.services.site_radar.scorer import (
    score_new_url,
    score_page_diff,
    score_removed_url,
)
from avaterra_bot.services.site_radar.sitemap import (
    filter_entries_by_robots,
    normalize_sitemap_host,
    parse_robots,
    parse_sitemap,
)
from avaterra_bot.services.site_radar.strategist import build_theme, is_duplicate_topic

logger = logging.getLogger(__name__)


@dataclass
class CycleStats:
    """Сводка одного цикла обхода."""

    pages_seen: int = 0
    pages_changed: int = 0
    pages_unchanged: int = 0
    new_urls: int = 0
    removed_urls: int = 0
    signals_total: int = 0
    signals_high: int = 0
    signals_medium: int = 0
    signals_low: int = 0
    noise_blocks: int = 0
    themes_added: int = 0
    themes_rejected_dup: int = 0
    notifications_sent: int = 0

    @property
    def noise_share(self) -> float:
        denom = self.signals_total + self.noise_blocks
        return (self.noise_blocks / denom) if denom else 0.0

    def as_dict(self) -> dict:
        data = dict(self.__dict__)
        data["noise_share"] = round(self.noise_share, 3)
        return data


class SiteRadarOrchestrator:
    """Координирует загрузку sitemap, обход страниц и запись сигналов."""

    def __init__(
        self,
        *,
        pool,
        bot: Bot,
        settings: AppSettings,
        project_id: str,
        website_url: str,
        priority_urls: tuple[str, ...] = (),
    ) -> None:
        self._pool = pool
        self._bot = bot
        self._settings = settings
        self._project_id = project_id
        self._website_url = website_url.rstrip("/") + "/"
        self._priority_urls = priority_urls

    async def run_full_cycle(self) -> CycleStats:
        """Полный обход: sitemap + все активные страницы."""
        stats = CycleStats()
        async with SiteRadarHttpClient() as http:
            sitemap_urls = await self._sync_sitemap(http, stats)
            await self._scan_pages(http, sitemap_urls, stats)
        logger.info("site_radar_cycle_done", extra=stats.as_dict())
        await self._log_cycle_metrics("full_cycle", stats)
        return stats

    async def run_priority_cycle(self) -> CycleStats:
        """Ускоренный обход - только приоритетные страницы (главная, курсы, blog)."""
        stats = CycleStats()
        async with SiteRadarHttpClient() as http:
            priority_pages: list[SitePageRecord] = []
            for url in self._priority_urls:
                category = categorize(url)
                page = await upsert_page(
                    self._pool,
                    project_id=self._project_id,
                    url=url,
                    category=category,
                )
                priority_pages.append(page)
            await self._scan_specific_pages(http, priority_pages, stats)
        logger.info("site_radar_priority_done", extra=stats.as_dict())
        await self._log_cycle_metrics("priority_cycle", stats)
        return stats

    async def _log_cycle_metrics(self, operation: str, stats: CycleStats) -> None:
        """Сохранить метрики цикла в integration_logs для долгосрочного аудита."""
        try:
            await log_integration(
                self._pool,
                project_id=self._project_id,
                provider="site_radar",
                operation=operation,
                request_id=f"{operation}-{datetime.now(timezone.utc).isoformat()}",
                status="ok" if stats.signals_total or stats.pages_seen else "noop",
                latency_ms=None,
                error_code=None,
                request_meta={"website_url": self._website_url},
                response_meta=stats.as_dict(),
            )
        except Exception:
            logger.exception("site_radar_metrics_log_failed")

    async def _sync_sitemap(
        self, http: SiteRadarHttpClient, stats: CycleStats
    ) -> set[str]:
        host = urlparse(self._website_url).netloc
        robots_url = f"https://{host}/robots.txt"
        sitemap_url = f"https://{host}/sitemap.xml"

        try:
            robots_resp = await http.fetch(robots_url)
            robots_rules = parse_robots(robots_resp.text)
        except Exception:
            logger.warning("robots_fetch_failed", extra={"url": robots_url})
            robots_rules = parse_robots("")

        try:
            sm_resp = await http.fetch(sitemap_url)
            entries = parse_sitemap(sm_resp.text)
        except Exception:
            logger.exception("sitemap_fetch_failed", extra={"url": sitemap_url})
            return set()

        entries = normalize_sitemap_host(entries, host)
        entries = filter_entries_by_robots(entries, robots_rules, host)

        sitemap_urls = {e.loc for e in entries}
        existing = {p.url: p for p in await list_active_pages(self._pool, self._project_id)}

        for entry in entries:
            category = categorize(entry.loc)
            page = await upsert_page(
                self._pool,
                project_id=self._project_id,
                url=entry.loc,
                category=category,
            )
            if entry.loc not in existing:
                signal = score_new_url(entry.loc, category)
                stats.new_urls += 1
                await self._persist_signal(page, None, signal, stats)

        removed = [url for url in existing if url not in sitemap_urls]
        if removed:
            await deactivate_pages(self._pool, self._project_id, removed)
            for url in removed:
                category = existing[url].category
                signal = score_removed_url(url, category)
                stats.removed_urls += 1
                page = existing[url]
                await self._persist_signal(page, None, signal, stats)

        return sitemap_urls

    async def _scan_pages(
        self,
        http: SiteRadarHttpClient,
        sitemap_urls: set[str],
        stats: CycleStats,
    ) -> None:
        pages = await list_active_pages(self._pool, self._project_id)
        await self._scan_specific_pages(http, pages, stats)

    async def _scan_specific_pages(
        self,
        http: SiteRadarHttpClient,
        pages: list[SitePageRecord],
        stats: CycleStats,
    ) -> None:
        for page in pages:
            try:
                await self._scan_one_page(http, page, stats)
            except Exception:
                logger.exception("site_radar_page_scan_failed", extra={"url": page.url})

    async def _scan_one_page(
        self,
        http: SiteRadarHttpClient,
        page: SitePageRecord,
        stats: CycleStats,
    ) -> None:
        stats.pages_seen += 1
        result = await http.fetch(
            page.url,
            etag=page.last_etag,
        )
        if result.not_modified:
            await touch_page_seen(self._pool, page.id, result.status)
            stats.pages_unchanged += 1
            return
        normalized = normalize_html(result.text)
        if (
            page.last_content_hash is not None
            and bytes(page.last_content_hash) == normalized.content_hash
        ):
            await touch_page_seen(self._pool, page.id, result.status)
            stats.pages_unchanged += 1
            return
        previous = await latest_version(self._pool, page.id)
        version = await insert_version(
            self._pool,
            page_id=page.id,
            http_status=result.status,
            content_hash=normalized.content_hash,
            cleaned_text=normalized.cleaned_text,
            blocks=normalized.blocks,
            meta={
                "title": normalized.title,
                "meta_description": normalized.meta_description,
            },
            etag=result.etag,
            last_modified=result.last_modified,
        )
        if previous is None:
            stats.pages_changed += 1
            return

        diff = diff_versions(previous.blocks, normalized.blocks)
        if not diff.has_changes:
            return
        stats.pages_changed += 1
        all_block_changes = list(diff.new_blocks) + list(diff.updated_blocks) + list(
            diff.removed_blocks
        )
        stats.noise_blocks += sum(
            1 for c in all_block_changes if c.change_type == "noise"
        )
        signals = score_page_diff(diff, page.category)
        for signal in signals:
            await self._persist_signal(page, version.id, signal, stats)

    async def _persist_signal(
        self,
        page: SitePageRecord,
        version_id: Optional[str],
        signal,
        stats: CycleStats,
    ) -> None:
        if signal.score <= 0:
            return
        record: SiteSignalRecord = await save_signal(
            self._pool,
            project_id=self._project_id,
            page_id=page.id,
            version_id=version_id,
            signal=signal,
        )
        stats.signals_total += 1
        if signal.severity == "high":
            stats.signals_high += 1
        elif signal.severity == "medium":
            stats.signals_medium += 1
        else:
            stats.signals_low += 1
        if signal.score >= 30:
            theme = build_theme(signal, page.category)
            recent = await recent_theme_topics(self._pool, self._project_id, days=90)
            check_duplicates = signal.signal_type not in {"new_url", "removed_url"}
            is_duplicate = (
                check_duplicates and is_duplicate_topic(theme.topic, recent)
            )
            if not is_duplicate:
                await insert_theme(
                    self._pool,
                    project_id=self._project_id,
                    topic=theme.topic,
                    angle=theme.angle,
                    post_type=theme.post_type,
                    priority=theme.priority,
                    source_signal_id=record.id,
                    payload=theme.payload,
                    source="radar",
                    audience=theme.audience,
                    rubric=theme.rubric,
                )
                stats.themes_added += 1
                await mark_signal_status(self._pool, record.id, "applied")
            else:
                stats.themes_rejected_dup += 1
                await mark_signal_status(self._pool, record.id, "rejected")
        if signal.severity == "high":
            sent = await notify_admins(
                self._bot,
                self._settings,
                [(record, signal.summary)],
            )
            stats.notifications_sent += sent
