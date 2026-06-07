"""
@file: test_funnel_flow.py
@description: Тесты бизнес-логики лид-воронки (без БД и Telegram)
@dependencies: pytest
@created: 2026-05-07
"""

from avaterra_bot.services.funnel.funnel_flow import (
    CHOICE_LABELS,
    CHOICE_LEARN,
    CHOICE_READY,
    CHOICE_THINKING,
    CHOICE_TO_SEGMENT,
    RESPONSES,
    SEGMENT_HOT,
    SEGMENT_INFO,
    SEGMENT_WARM,
    segment_for_choice,
)


def test_choices_have_labels_and_segments() -> None:
    for key in (CHOICE_LEARN, CHOICE_THINKING, CHOICE_READY):
        assert key in CHOICE_LABELS, f"{key} без подписи кнопки"
        assert key in CHOICE_TO_SEGMENT, f"{key} без сегмента"
        assert key in RESPONSES, f"{key} без ответа"


def test_segment_mapping_is_business_consistent() -> None:
    assert segment_for_choice(CHOICE_LEARN) == SEGMENT_INFO
    assert segment_for_choice(CHOICE_THINKING) == SEGMENT_WARM
    assert segment_for_choice(CHOICE_READY) == SEGMENT_HOT
    assert segment_for_choice("unknown") is None


def test_warm_and_hot_responses_notify_admin() -> None:
    assert RESPONSES[CHOICE_THINKING].notify_admin is True
    assert RESPONSES[CHOICE_READY].notify_admin is True
    assert RESPONSES[CHOICE_LEARN].notify_admin is False


def test_learn_response_is_terminal_with_links() -> None:
    learn = RESPONSES[CHOICE_LEARN]
    assert learn.is_terminal is True
    assert "avaterra.pro" in learn.text
    assert "<a" in learn.text


def test_responses_have_meaningful_text_length() -> None:
    for key, step in RESPONSES.items():
        assert len(step.text) > 40, f"Слишком короткий ответ для {key}"
