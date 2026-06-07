"""
@file: content_worker.py
@description: APScheduler задачи Content Planner и Publisher (Пн/Ср/Пт)
@dependencies: apscheduler, aiogram
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.services.planner.weekly_orchestrator import run_weekly_pipeline
from avaterra_bot.services.publisher.channel_publisher import publish_due_today
from avaterra_bot.workers.site_radar_worker import (
    DEFAULT_PROJECT_NAME,
    DEFAULT_WEBSITE_URL,
)

logger = logging.getLogger(__name__)

DEFAULT_PLANNER_DAY_OF_WEEK = "sun"
DEFAULT_PLANNER_HOUR = 19
DEFAULT_PUBLISHER_DAY_OF_WEEK_7 = "mon,tue,wed,thu,fri,sat,sun"
DEFAULT_PUBLISHER_DAY_OF_WEEK_3 = "mon,wed,fri"


def _safe_int(value: str | int | None) -> int | None:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


async def attach_content_jobs(
    bot: Bot,
    settings: AppSettings,
    pool,
    scheduler: AsyncIOScheduler,
) -> str:
    """Добавить в существующий планировщик задачи Planner и Publisher."""
    target_channel = _safe_int(settings.target_channel_id) or 0
    project = await ensure_default_project(
        pool,
        name=DEFAULT_PROJECT_NAME,
        website_url=DEFAULT_WEBSITE_URL,
        channel_id=target_channel,
        timezone=settings.timezone,
    )

    async def _planner_job() -> None:
        if not settings.weekly_planner_enabled:
            return
        outcome = await run_weekly_pipeline(
            bot, pool, project_id=project.id, settings=settings
        )
        logger.info(
            "weekly_pipeline_done",
            extra={
                "plan_id": outcome.plan_id,
                "items_total": outcome.items_total,
                "items_prepared": outcome.items_prepared,
                "items_blocked": outcome.items_blocked,
            },
        )

    async def _publisher_job() -> None:
        outcomes = await publish_due_today(
            bot, pool, project_id=project.id, settings=settings
        )
        logger.info(
            "publisher_run_done",
            extra={
                "items": len(outcomes),
                "published": sum(1 for o in outcomes if o.status == "published"),
                "dry_run": sum(1 for o in outcomes if o.dry_run),
                "failed": sum(1 for o in outcomes if o.status == "failed"),
            },
        )

    planner_callable: Callable[[], Awaitable[None]] = _planner_job
    publisher_callable: Callable[[], Awaitable[None]] = _publisher_job

    scheduler.add_job(
        planner_callable,
        trigger=CronTrigger(
            day_of_week=DEFAULT_PLANNER_DAY_OF_WEEK,
            hour=DEFAULT_PLANNER_HOUR,
            minute=0,
            timezone=settings.timezone,
        ),
        id="content_planner_weekly",
        name="Weekly content plan + generation",
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=300),
    )
    publisher_days = (
        DEFAULT_PUBLISHER_DAY_OF_WEEK_7
        if settings.posts_per_week >= 7
        else DEFAULT_PUBLISHER_DAY_OF_WEEK_3
    )
    publisher_name = (
        "Channel publisher daily 7/7"
        if settings.posts_per_week >= 7
        else "Channel publisher Mon/Wed/Fri"
    )
    scheduler.add_job(
        publisher_callable,
        trigger=CronTrigger(
            day_of_week=publisher_days,
            hour=settings.publish_hour,
            minute=settings.publish_minute,
            timezone=settings.timezone,
        ),
        id="content_publisher_daily",
        name=publisher_name,
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    logger.info(
        "content_jobs_scheduled",
        extra={
            "planner_cron": f"{DEFAULT_PLANNER_DAY_OF_WEEK} {DEFAULT_PLANNER_HOUR}:00",
            "publisher_cron": (
                f"{publisher_days} "
                f"{settings.publish_hour:02d}:{settings.publish_minute:02d}"
            ),
            "timezone": settings.timezone,
            "posts_per_week": settings.posts_per_week,
        },
    )
    return project.id
