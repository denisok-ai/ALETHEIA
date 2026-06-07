"""
@file: funnel_flow.py
@description: Сценарий лид-воронки: текстовые блоки и логика сегментации
@dependencies: -
@created: 2026-05-07
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


SEGMENT_INFO = "info"
SEGMENT_WARM = "warm"
SEGMENT_HOT = "hot"

CHOICE_LEARN = "learn"
CHOICE_THINKING = "thinking"
CHOICE_READY = "ready"

CHOICE_TO_SEGMENT: dict[str, str] = {
    CHOICE_LEARN: SEGMENT_INFO,
    CHOICE_THINKING: SEGMENT_WARM,
    CHOICE_READY: SEGMENT_HOT,
}


@dataclass(frozen=True)
class FunnelStep:
    text: str
    is_terminal: bool = False
    notify_admin: bool = False
    next_step: Optional[str] = None


WELCOME_TEXT = (
    "Здравствуйте! Я бот <b>Avaterra</b>. Помогу разобраться, что вам сейчас "
    "ближе по практике мышечного тестирования.\n\n"
    "Выберите вариант, и я пришлю подходящие материалы или отвечу на вопросы."
)

CHOICE_LABELS: dict[str, str] = {
    CHOICE_LEARN: "Хочу узнать о методике подробнее",
    CHOICE_THINKING: "Думаю про курс — есть вопросы",
    CHOICE_READY: "Готов(а) обсудить участие",
}

RESPONSES: dict[str, FunnelStep] = {
    CHOICE_LEARN: FunnelStep(
        text=(
            "Отлично! Делюсь короткой подборкой:\n\n"
            "• Что такое мышечное тестирование: <a href=\"https://avaterra.pro/about\">avaterra.pro/about</a>\n"
            "• Первые шаги: <a href=\"https://avaterra.pro/blog/pervye-shagi-myshechnogo-testirovaniya\">читать в блоге</a>\n"
            "• Ответы на частые вопросы: <a href=\"https://avaterra.pro/faq\">avaterra.pro/faq</a>\n\n"
            "Если появятся вопросы — напишите сюда, мы поможем."
        ),
        is_terminal=True,
    ),
    CHOICE_THINKING: FunnelStep(
        text=(
            "Понимаю — выбрать формат важно. Расскажите коротко, что именно хочется решить с помощью практики? "
            "Я передам команде, и вам ответит специалист.\n\n"
            "Можете отправить голосовое или текстовое сообщение."
        ),
        notify_admin=True,
    ),
    CHOICE_READY: FunnelStep(
        text=(
            "Отлично, что вы готовы! Один уточняющий вопрос: когда планируете начать — "
            "в ближайший поток или гибко?\n\n"
            "Просто напишите ответ ниже, и я передам менеджеру."
        ),
        notify_admin=True,
    ),
}

THANKS_AFTER_FREEFORM = (
    "Спасибо! Сообщение передано команде Avaterra. "
    "С вами свяжется специалист в ближайшее время."
)

UNKNOWN_INPUT = (
    "Чтобы я не запутался — выберите один из вариантов кнопками выше "
    "или напишите /start, чтобы начать сначала."
)


def segment_for_choice(choice: str) -> Optional[str]:
    return CHOICE_TO_SEGMENT.get(choice)
