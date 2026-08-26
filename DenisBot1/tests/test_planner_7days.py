"""
@file: test_planner_7days.py
@description: Тесты 7-дневного планировщика и расписания типов постов
@dependencies: services.planner.content_planner
@created: 2026-05-07
"""

from __future__ import annotations

from datetime import date

from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.services.planner.content_planner import (
    WEEKDAY_TO_POST_TYPE_DEFAULT,
    _post_types_schedule,
    _publish_dates_in_week,
    upcoming_week_monday,
    week_bounds,
)


def test_week_bounds_starts_monday():
    monday, sunday = week_bounds(date(2026, 5, 7))
    assert monday.weekday() == 0
    assert sunday.weekday() == 6
    assert (sunday - monday).days == 6


def test_default_schedule_covers_seven_days():
    brand = BrandProfile(project_id="11111111-1111-1111-1111-111111111111")
    schedule = _post_types_schedule(brand, posts_per_week=7)
    assert set(schedule.keys()) == {0, 1, 2, 3, 4, 5, 6}
    assert schedule == WEEKDAY_TO_POST_TYPE_DEFAULT


def test_three_per_week_overrides_keep_legacy():
    brand = BrandProfile(project_id="11111111-1111-1111-1111-111111111111")
    schedule = _post_types_schedule(brand, posts_per_week=3)
    assert set(schedule.keys()) == {0, 2, 4}


def test_schedule_uses_brand_templates_when_present():
    brand = BrandProfile(
        project_id="11111111-1111-1111-1111-111111111111",
        templates=[
            {"id": "educational", "weekday": "monday"},
            {"id": "pain", "weekday": "tuesday"},
            {"id": "practice", "weekday": "wednesday"},
            {"id": "author", "weekday": "thursday"},
            {"id": "faq", "weekday": "friday"},
            {"id": "course", "weekday": "saturday"},
            {"id": "reflection", "weekday": "sunday"},
        ],
    )
    schedule = _post_types_schedule(brand, posts_per_week=7)
    assert schedule == {
        0: "educational",
        1: "pain",
        2: "practice",
        3: "author",
        4: "faq",
        5: "course",
        6: "reflection",
    }


def test_publish_dates_match_week():
    monday = date(2026, 5, 4)
    schedule = WEEKDAY_TO_POST_TYPE_DEFAULT
    dates = _publish_dates_in_week(monday, schedule)
    assert len(dates) == 7
    assert [d.weekday() for d, _ in dates] == [0, 1, 2, 3, 4, 5, 6]
    assert [pt for _, pt in dates] == [
        "educational",
        "pain",
        "practice",
        "author",
        "faq",
        "course",
        "reflection",
    ]


def test_upcoming_week_monday_on_sunday_returns_next_monday():
    """В воскресенье cron должен планировать на ЗАВТРА (понедельник новой недели)."""
    sunday = date(2026, 5, 10)
    assert sunday.weekday() == 6
    target = upcoming_week_monday(sunday)
    assert target == date(2026, 5, 11)
    assert target.weekday() == 0


def test_upcoming_week_monday_on_monday_returns_same_day():
    """Понедельник — это уже начало новой недели; cron планирует на сегодня."""
    monday = date(2026, 5, 11)
    assert monday.weekday() == 0
    target = upcoming_week_monday(monday)
    assert target == monday


def test_upcoming_week_monday_mid_week_returns_next_monday():
    """В середине недели cron планирует на следующий понедельник."""
    wednesday = date(2026, 5, 13)
    assert wednesday.weekday() == 2
    target = upcoming_week_monday(wednesday)
    assert target == date(2026, 5, 18)
    assert target.weekday() == 0
