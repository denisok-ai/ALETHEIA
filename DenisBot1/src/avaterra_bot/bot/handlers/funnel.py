"""
@file: funnel.py
@description: Handlers лид-воронки: /start, выбор кнопки, free-form ответы
@dependencies: aiogram, asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from typing import Optional

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from avaterra_bot import __version__
from avaterra_bot.config import get_settings
from avaterra_bot.db.repositories.leads import (
    DEFAULT_FUNNEL_SLUG,
    ensure_default_funnel,
    fetch_recent_user_events,
    log_lead_event,
)
from avaterra_bot.db.repositories.projects import ensure_default_project
from avaterra_bot.services.funnel.funnel_flow import (
    CHOICE_LABELS,
    CHOICE_LEARN,
    CHOICE_READY,
    CHOICE_THINKING,
    RESPONSES,
    SEGMENT_HOT,
    SEGMENT_WARM,
    THANKS_AFTER_FREEFORM,
    UNKNOWN_INPUT,
    WELCOME_TEXT,
    segment_for_choice,
)
from avaterra_bot.workers.site_radar_worker import (
    DEFAULT_PROJECT_NAME,
    DEFAULT_WEBSITE_URL,
)

logger = logging.getLogger(__name__)

router = Router(name="funnel")

CALLBACK_PREFIX = "funnel:"
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


def _build_choice_keyboard() -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=label, callback_data=f"{CALLBACK_PREFIX}{key}")]
        for key, label in CHOICE_LABELS.items()
    ]
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _is_admin(user_id: Optional[int]) -> bool:
    if user_id is None:
        return False
    return user_id in get_settings().admin_ids


def _funnel_enabled() -> bool:
    return get_settings().funnel_enabled


REDIRECT_TEXT = (
    "Здравствуйте! Школа <b>«Аватэрра»</b> переехала в основной бот — "
    "там курсы, материалы, поддержка и личный кабинет.\n\n"
    "Нажмите кнопку ниже и напишите там /start — помогу с вопросами по курсам, "
    "отвечу на частые вопросы сразу и передам команде, если нужен живой разбор."
)


def _build_redirect_keyboard() -> InlineKeyboardMarkup:
    url = f"https://t.me/{get_settings().portal_bot_username}"
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="Перейти в бот школы", url=url)]]
    )


async def _send_redirect(message: Message) -> None:
    """Воронка выключена: уводим человека в бота портала."""
    await message.answer(
        REDIRECT_TEXT,
        reply_markup=_build_redirect_keyboard(),
        disable_web_page_preview=True,
    )


@router.message(Command("start"))
async def cmd_start(message: Message) -> None:
    user = message.from_user
    if user is None:
        return
    if _is_admin(user.id):
        await message.answer(
            "Бот школы Аватэрра готов к работе.\n"
            f"Версия: {__version__}\n"
            "Используйте /admin_help для списка команд."
        )
        return
    if not _funnel_enabled():
        await _send_redirect(message)
        return
    if _pool is None:
        await message.answer("Бот ещё запускается, попробуйте через минуту.")
        return
    _, funnel_id = await _ensure_ids()
    await log_lead_event(
        _pool,
        funnel_id=funnel_id,
        telegram_user_id=user.id,
        step="start",
        username=user.username,
        first_name=user.first_name,
    )
    await message.answer(
        WELCOME_TEXT,
        reply_markup=_build_choice_keyboard(),
        disable_web_page_preview=True,
    )


@router.callback_query(F.data.startswith(CALLBACK_PREFIX))
async def on_funnel_choice(query: CallbackQuery, bot: Bot) -> None:
    user = query.from_user
    if user is None or query.data is None:
        return
    if not _funnel_enabled():
        if query.message is not None:
            try:
                await query.message.edit_reply_markup(reply_markup=None)
            except Exception:
                pass
            await _send_redirect(query.message)
        await query.answer()
        return
    if _pool is None:
        await query.answer("Бот ещё запускается.", show_alert=False)
        return

    choice = query.data[len(CALLBACK_PREFIX):]
    step = RESPONSES.get(choice)
    if step is None:
        await query.answer("Не знаю такую кнопку.", show_alert=False)
        return

    _, funnel_id = await _ensure_ids()
    segment = segment_for_choice(choice)
    await log_lead_event(
        _pool,
        funnel_id=funnel_id,
        telegram_user_id=user.id,
        step="choice",
        segment=segment,
        payload={"choice": choice, "label": CHOICE_LABELS.get(choice, "")},
        username=user.username,
        first_name=user.first_name,
    )
    if query.message is not None:
        try:
            await query.message.edit_reply_markup(reply_markup=None)
        except Exception:
            pass
        await query.message.answer(step.text, disable_web_page_preview=True)
    await query.answer()
    if step.notify_admin and segment in (SEGMENT_WARM, SEGMENT_HOT):
        await _notify_admins_about_lead(
            bot,
            user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            segment=segment,
            choice_label=CHOICE_LABELS.get(choice, ""),
        )


@router.message(F.text & ~F.text.startswith("/"))
async def on_freeform_message(message: Message, bot: Bot) -> None:
    user = message.from_user
    if user is None or _is_admin(user.id):
        return
    if not _funnel_enabled():
        await _send_redirect(message)
        return
    if _pool is None:
        return
    _, funnel_id = await _ensure_ids()
    history = await fetch_recent_user_events(
        _pool, funnel_id=funnel_id, telegram_user_id=user.id, limit=5
    )
    last_segment: Optional[str] = None
    for event in history:
        if event.segment:
            last_segment = event.segment
            break
    if last_segment in (SEGMENT_WARM, SEGMENT_HOT):
        await log_lead_event(
            _pool,
            funnel_id=funnel_id,
            telegram_user_id=user.id,
            step="freeform",
            segment=last_segment,
            payload={"text": (message.text or "")[:400]},
            username=user.username,
            first_name=user.first_name,
        )
        await message.answer(THANKS_AFTER_FREEFORM)
        await _notify_admins_about_lead(
            bot,
            user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            segment=last_segment,
            free_text=message.text or "",
        )
    else:
        await message.answer(
            UNKNOWN_INPUT,
            reply_markup=_build_choice_keyboard(),
        )


async def _notify_admins_about_lead(
    bot: Bot,
    *,
    user_id: int,
    username: Optional[str],
    first_name: Optional[str],
    segment: str,
    choice_label: str = "",
    free_text: str = "",
) -> None:
    settings = get_settings()
    admin_ids = settings.admin_ids
    if not admin_ids:
        return
    pretty_user = f"<a href=\"tg://user?id={user_id}\">{first_name or username or user_id}</a>"
    handle = f" (@{username})" if username else ""
    body_lines = [
        f"<b>Новый лид</b> [{segment}]",
        f"Пользователь: {pretty_user}{handle}",
    ]
    if choice_label:
        body_lines.append(f"Выбор: {choice_label}")
    if free_text:
        snippet = free_text[:600]
        body_lines.append(f"Сообщение:\n<i>{snippet}</i>")
    text = "\n".join(body_lines)
    for admin_id in admin_ids:
        try:
            await bot.send_message(admin_id, text, disable_web_page_preview=True)
        except Exception as exc:
            logger.warning(
                "lead_notify_failed",
                extra={"admin_id": admin_id, "error": str(exc)},
            )
