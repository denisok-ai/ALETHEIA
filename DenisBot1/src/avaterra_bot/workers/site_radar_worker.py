"""
@file: site_radar_worker.py
@description: Запуск Site Radar по расписанию через APScheduler в одном процессе с ботом
@dependencies: apscheduler, aiogram
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.services.site_radar.orchestrator import SiteRadarOrchestrator

logger = logging.getLogger(__name__)

DEFAULT_FULL_INTERVAL_HOURS = 6
DEFAULT_PRIORITY_INTERVAL_HOURS = 1
DEFAULT_FIRST_PRIORITY_DELAY_SECONDS = 60
DEFAULT_FIRST_FULL_DELAY_SECONDS = 180
DEFAULT_PROJECT_NAME = "Avaterra"
DEFAULT_WEBSITE_URL = "https://avaterra.pro/"
DEFAULT_PRIORITY_URLS = (
    "https://avaterra.pro/",
    "https://avaterra.pro/blog",
    "https://avaterra.pro/faq",
    "https://avaterra.pro/course/navyki-myshechnogo-testirovaniya",
    "https://avaterra.pro/course/probuzhdenie",
)


def _safe_int(value: str | int | None) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


async def _bootstrap_project(pool, settings: AppSettings) -> str:
    target_channel = _safe_int(settings.target_channel_id) or 0
    project = await ensure_default_project(
        pool,
        name=DEFAULT_PROJECT_NAME,
        website_url=DEFAULT_WEBSITE_URL,
        channel_id=target_channel,
        timezone=settings.timezone,
    )
    return project.id


async def start_site_radar(
    bot: Bot,
    settings: AppSettings,
    pool,
) -> AsyncIOScheduler:
    """Поднять APScheduler с двумя задачами Site Radar."""
    project_id = await _bootstrap_project(pool, settings)
    orchestrator = SiteRadarOrchestrator(
        pool=pool,
        bot=bot,
        settings=settings,
        project_id=project_id,
        website_url=DEFAULT_WEBSITE_URL,
        priority_urls=DEFAULT_PRIORITY_URLS,
    )

    scheduler = AsyncIOScheduler(timezone=settings.timezone)

    full_job: Callable[[], Awaitable[object]] = orchestrator.run_full_cycle
    priority_job: Callable[[], Awaitable[object]] = orchestrator.run_priority_cycle

    now = datetime.now(timezone.utc)
    scheduler.add_job(
        full_job,
        trigger=IntervalTrigger(hours=DEFAULT_FULL_INTERVAL_HOURS, jitter=120),
        id="site_radar_full",
        name="Site Radar full cycle",
        coalesce=True,
        max_instances=1,
        misfire_grace_time=600,
        next_run_time=now + timedelta(seconds=DEFAULT_FIRST_FULL_DELAY_SECONDS),
    )
    scheduler.add_job(
        priority_job,
        trigger=IntervalTrigger(hours=DEFAULT_PRIORITY_INTERVAL_HOURS, jitter=60),
        id="site_radar_priority",
        name="Site Radar priority cycle",
        coalesce=True,
        max_instances=1,
        misfire_grace_time=300,
        next_run_time=now + timedelta(seconds=DEFAULT_FIRST_PRIORITY_DELAY_SECONDS),
    )
    scheduler.start()
    logger.info(
        "site_radar_scheduler_started",
        extra={
            "full_interval_hours": DEFAULT_FULL_INTERVAL_HOURS,
            "priority_interval_hours": DEFAULT_PRIORITY_INTERVAL_HOURS,
        },
    )
    return scheduler
