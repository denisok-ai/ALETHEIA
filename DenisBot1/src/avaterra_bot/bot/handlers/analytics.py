"""
@file: analytics.py
@description: Админ-команды аналитики: ввод статистики и сводные отчёты
@dependencies: aiogram, asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from typing import Optional

from aiogram import Router
from aiogram.filters import Command, CommandObject
from aiogram.types import Message

from avaterra_bot.bot.middleware.admin_acl import AdminOnlyMiddleware
from avaterra_bot.config import get_settings
from avaterra_bot.db.repositories.analytics import (
    get_published_item_brief,
    latest_post_stats,
    record_post_statistics,
    weekly_summary,
)
from avaterra_bot.db.repositories.leads import (
    DEFAULT_FUNNEL_SLUG,
    ensure_default_funnel,
    funnel_segment_stats,
    funnel_total_starts,
)
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.workers.site_radar_worker import (
    DEFAULT_PROJECT_NAME,
    DEFAULT_WEBSITE_URL,
)

logger = logging.getLogger(__name__)

router = Router(name="analytics")
router.message.middleware(AdminOnlyMiddleware())

_pool = None
_project_id: Optional[str] = None
_funnel_id: Optional[str] = None


def bind_pool(pool) -> None:
    global _pool
    _pool = pool


async def _ensure_ids() -> tuple[str, str]:
    global _project_id, _funnel_id
    if _project_id and _funnel_id:
        return _project_id, _funnel_id
    settings = get_settings()
    target = int(settings.target_channel_id) if settings.target_channel_id else 0
    project = await ensure_default_project(
        _pool,
        name=DEFAULT_PROJECT_NAME,
        website_url=DEFAULT_WEBSITE_URL,
        channel_id=target,
        timezone=settings.timezone,
    )
    funnel = await ensure_default_funnel(
        _pool,
        project_id=project.id,
        slug=DEFAULT_FUNNEL_SLUG,
    )
    _project_id = project.id
    _funnel_id = funnel.id
    return _project_id, _funnel_id


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    project_id, funnel_id = await _ensure_ids()
    summary = await weekly_summary(_pool, project_id=project_id, days=7)
    funnel_starts = await funnel_total_starts(_pool, funnel_id=funnel_id, days=7)
    segments = await funnel_segment_stats(_pool, funnel_id=funnel_id, days=7)
    seg_lines = [f"  {seg}: {count}" for seg, count in segments.items()] or [
        "  пока нет сегментаций"
    ]
    parts = [
        "<b>Статистика за 7 дней</b>",
        f"Постов опубликовано: {summary['total_posts']} "
        f"(info {summary['info_count']}, sales {summary['sales_count']})",
        f"Суммарные просмотры: {summary['total_views']}",
        f"Средние просмотры: {summary['avg_views']:.0f} "
        f"(info {summary['avg_views_info']:.0f}, sales {summary['avg_views_sales']:.0f})",
        f"Средние реакции: {summary['avg_reactions']:.1f}",
        f"Средний CTR: {summary['avg_ctr']:.2f}%",
        "",
        f"<b>Воронка</b>",
        f"Запусков /start: {funnel_starts}",
        "Сегменты:",
        *seg_lines,
    ]
    await message.answer("\n".join(parts))


@router.message(Command("stats_full"))
async def cmd_stats_full(message: Message) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    project_id, _ = await _ensure_ids()
    items = await latest_post_stats(_pool, project_id=project_id, days=14)
    if not items:
        await message.answer("За 14 дней ещё нет опубликованных постов.")
        return
    lines = ["<b>Опубликованные посты (14 дней)</b>"]
    for stat in items:
        topic = stat.topic[:60] + ("…" if len(stat.topic) > 60 else "")
        lines.append(
            f"• {stat.publish_date} [{stat.post_type}] views={stat.views} "
            f"reactions={stat.reactions} CTR={stat.ctr:.1f}%\n"
            f"  {topic}\n"
            f"  id={stat.item_id}"
        )
    await message.answer("\n".join(lines)[:3900])


@router.message(Command("stat"))
async def cmd_stat(message: Message, command: CommandObject) -> None:
    if _pool is None:
        await message.answer("DB pool не инициализирован.")
        return
    args = (command.args or "").strip().split()
    if len(args) < 2:
        await message.answer(
            "Использование: /stat <item_id> <views> [reactions] [comments] [saves] [ctr]"
        )
        return
    item_id = args[0]

    def _to_int(s: str, default: int = 0) -> int:
        try:
            return int(s)
        except ValueError:
            return default

    def _to_float(s: str, default: float = 0.0) -> float:
        try:
            return float(s.replace(",", "."))
        except ValueError:
            return default

    views = _to_int(args[1])
    reactions = _to_int(args[2]) if len(args) > 2 else 0
    comments = _to_int(args[3]) if len(args) > 3 else 0
    saves = _to_int(args[4]) if len(args) > 4 else 0
    ctr = _to_float(args[5]) if len(args) > 5 else 0.0

    project_id, _ = await _ensure_ids()
    brief = await get_published_item_brief(
        _pool, project_id=project_id, item_id=item_id
    )
    if brief is None:
        await message.answer("Пост не найден или не относится к проекту.")
        return
    await record_post_statistics(
        _pool,
        content_item_id=item_id,
        views=views,
        reactions=reactions,
        comments=comments,
        saves=saves,
        ctr=ctr,
        source="manual",
    )
    await message.answer(
        f"Записано: {brief['publish_date']} [{brief['post_type']}]\n"
        f"views={views}, reactions={reactions}, ctr={ctr:.2f}%"
    )
