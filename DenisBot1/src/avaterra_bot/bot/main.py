"""
@file: main.py
@description: Точка сборки и запуска aiogram-бота с интеграцией Site Radar
@dependencies: aiogram, asyncpg, apscheduler
@created: 2026-05-07
"""

from __future__ import annotations

import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from avaterra_bot.bot.handlers import admin as admin_handlers
from avaterra_bot.bot.handlers import analytics as analytics_handlers
from avaterra_bot.bot.handlers import funnel as funnel_handlers
from avaterra_bot.config import get_settings
from avaterra_bot.db.engine import close_pool, get_pool
from avaterra_bot.db.repositories.brand import ensure_default_brand_profile
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.services.knowledge.loader import apply_kb_to_project
from avaterra_bot.workers.content_worker import attach_content_jobs
from avaterra_bot.workers.site_radar_worker import (
    DEFAULT_PROJECT_NAME,
    DEFAULT_WEBSITE_URL,
    start_site_radar,
)

logger = logging.getLogger(__name__)


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher()
    dp.include_router(funnel_handlers.router)
    dp.include_router(admin_handlers.router)
    dp.include_router(analytics_handlers.router)
    return dp


def build_bot() -> Bot:
    settings = get_settings()
    token = settings.bot_token.get_secret_value()
    if not token:
        raise RuntimeError("BOT_TOKEN is not configured")
    return Bot(
        token=token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


async def run_polling() -> None:
    settings = get_settings()
    bot = build_bot()
    dispatcher = build_dispatcher()

    pool = None
    scheduler = None
    try:
        pool = await get_pool()
        admin_handlers.bind_pool(pool)
        analytics_handlers.bind_pool(pool)
        funnel_handlers.bind_pool(pool)
        await _bootstrap_knowledge_base(pool, settings)
        if settings.scheduler_enabled:
            scheduler = await start_site_radar(bot, settings, pool)
            project_id = await attach_content_jobs(bot, settings, pool, scheduler)
            admin_handlers.bind_scheduler(scheduler)
            admin_handlers.bind_project_id(project_id)
        logger.info("bot_polling_start")
        await dispatcher.start_polling(bot, handle_signals=False)
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)
        await bot.session.close()
        await close_pool()
        logger.info("bot_polling_stopped")


async def _bootstrap_knowledge_base(pool, settings) -> None:
    """Гарантировать актуальный brand profile и темы из knowledge/avaterra.yaml."""
    target = int(settings.target_channel_id) if settings.target_channel_id else 0
    project = await ensure_default_project(
        pool,
        name=DEFAULT_PROJECT_NAME,
        website_url=DEFAULT_WEBSITE_URL,
        channel_id=target,
        timezone=settings.timezone,
    )
    await ensure_default_brand_profile(pool, project.id)
    kb_path = settings.kb_yaml_path
    if not kb_path.exists():
        logger.warning("kb_yaml_missing", extra={"path": str(kb_path)})
        return
    try:
        _, outcome = await apply_kb_to_project(
            pool, project_id=project.id, kb_path=kb_path
        )
        logger.info(
            "kb_bootstrap_done",
            extra={
                "kb_version": outcome.kb_version,
                "themes_inserted": outcome.themes_inserted,
                "themes_updated": outcome.themes_updated,
            },
        )
    except Exception as exc:
        logger.exception("kb_bootstrap_failed", extra={"error": str(exc)})


def main_polling() -> None:
    asyncio.run(run_polling())
