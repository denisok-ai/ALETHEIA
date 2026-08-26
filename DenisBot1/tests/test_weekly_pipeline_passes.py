"""
@file: test_weekly_pipeline_passes.py
@description: Тесты многоходового недельного пайплайна и сверки плана 7/7
@dependencies: services.planner.weekly_orchestrator
@created: 2026-05-12
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.db.repositories.content import ContentItemRecord, ContentPlanRecord
from avaterra_bot.services.generator.pipeline import PreparationOutcome
from avaterra_bot.services.planner import weekly_orchestrator
from avaterra_bot.services.planner.content_planner import WeekPlan
from avaterra_bot.services.planner.weekly_orchestrator import (
    _verify_plan,
    run_weekly_pipeline,
)


WEEK_START = date(2026, 5, 11)
WEEK_END = date(2026, 5, 17)
PROJECT_ID = "00000000-0000-0000-0000-000000000000"
PLAN_ID = "11111111-1111-1111-1111-111111111111"


@dataclass
class FakeSettings:
    posts_per_week: int = 7
    weekly_pipeline_extra_passes: int = 1
    weekly_pipeline_pass_delay_seconds: float = 0.0


def _item(
    offset_days: int,
    *,
    post_type: str,
    status: str,
    final_text: str | None = None,
    image_url: str | None = None,
) -> ContentItemRecord:
    return ContentItemRecord(
        id=f"item-{offset_days}",
        plan_id=PLAN_ID,
        publish_date=WEEK_START + timedelta(days=offset_days),
        post_type=post_type,
        topic=f"тема-{offset_days}",
        objective="доверие",
        outline="-",
        cta="-",
        status=status,
        generated_text=final_text,
        final_text=final_text,
        image_url=image_url,
        image_prompt=None,
        image_task_id=None,
        theme_id=None,
        dedup_status="passed" if final_text else None,
        dedup_reason=None,
        retry_count=0,
        last_error=None,
        approved_by=None,
        published_at=None,
    )


def test_verify_plan_all_ready_for_seven_days():
    items = [
        _item(i, post_type=f"type{i}", status="ready", final_text="t", image_url="u")
        for i in range(7)
    ]
    ready, all_ready, problems = _verify_plan(
        items, week_start=WEEK_START, week_end=WEEK_END, posts_per_week=7
    )
    assert ready == 7
    assert all_ready is True
    assert problems == []


def test_verify_plan_flags_quality_failed_and_missing_day():
    items = [
        _item(0, post_type="educational", status="ready", final_text="t", image_url="u"),
        _item(1, post_type="pain", status="quality_failed"),
        _item(2, post_type="practice", status="text_ready", final_text="t"),
    ]
    ready, all_ready, problems = _verify_plan(
        items, week_start=WEEK_START, week_end=WEEK_END, posts_per_week=7
    )
    assert ready == 1
    assert all_ready is False
    statuses = [p.status for p in problems]
    assert "quality_failed" in statuses
    assert "text_ready" in statuses
    # missing только для дней без item; day1 с quality_failed не дублируется
    missing_dates = [p.publish_date for p in problems if p.status == "missing"]
    assert WEEK_START + timedelta(days=1) not in missing_dates
    assert WEEK_START + timedelta(days=3) in missing_dates
    assert len([p for p in problems if p.status == "missing"]) == 4


def test_verify_plan_admin_preview_sent_counts_as_ready():
    items = [
        _item(i, post_type=f"type{i}", status="admin_preview_sent", final_text="t")
        for i in range(7)
    ]
    ready, all_ready, problems = _verify_plan(
        items, week_start=WEEK_START, week_end=WEEK_END, posts_per_week=7
    )
    assert ready == 7
    assert all_ready is True
    assert problems == []


@pytest.mark.asyncio
async def test_run_weekly_pipeline_retries_stuck_draft_on_pass2(monkeypatch):
    """Pass1 оставил draft (сбой) — pass2 обязан подхватить draft и довести до ready."""
    pass1_items = [_item(i, post_type=f"type{i}", status="draft") for i in range(7)]
    after_pass1_items = [
        _item(0, post_type="type0", status="ready", final_text="t", image_url="u"),
        _item(1, post_type="type1", status="ready", final_text="t", image_url="u"),
        _item(2, post_type="type2", status="draft"),  # stuck after exception path
        _item(3, post_type="type3", status="ready", final_text="t", image_url="u"),
        _item(4, post_type="type4", status="ready", final_text="t", image_url="u"),
        _item(5, post_type="type5", status="ready", final_text="t", image_url="u"),
        _item(6, post_type="type6", status="ready", final_text="t", image_url="u"),
    ]
    final_items = [
        _item(i, post_type=f"type{i}", status="ready", final_text="t", image_url="u")
        for i in range(7)
    ]
    snapshots = iter([pass1_items, after_pass1_items, after_pass1_items, final_items])

    async def fake_list_plan_items(pool, plan_id):
        return next(snapshots)

    plan_record = ContentPlanRecord(
        id=PLAN_ID,
        project_id=PROJECT_ID,
        week_start=WEEK_START,
        week_end=WEEK_END,
        status="draft",
    )

    async def fake_build_week_plan(pool, project_id, *, posts_per_week, target_monday):
        return WeekPlan(plan=plan_record, items=[])

    call_log: list[str] = []

    async def prepare_side_effect(*args, **kwargs):
        item = kwargs["item"]
        call_log.append(item.id)
        return PreparationOutcome(
            item_id=item.id,
            status="ready",
            has_text=True,
            has_image=True,
            text_preview="ok",
            image_url="u",
            dedup_status="passed",
        )

    prepare_mock = AsyncMock(side_effect=prepare_side_effect)

    monkeypatch.setattr(weekly_orchestrator, "list_plan_items", fake_list_plan_items)
    monkeypatch.setattr(weekly_orchestrator, "build_week_plan", fake_build_week_plan)
    monkeypatch.setattr(weekly_orchestrator, "prepare_item", prepare_mock)
    monkeypatch.setattr(
        weekly_orchestrator,
        "complete_image_for_item",
        AsyncMock(side_effect=AssertionError("text_ready не ожидается")),
    )
    monkeypatch.setattr(
        weekly_orchestrator,
        "ensure_default_brand_profile",
        AsyncMock(return_value=BrandProfile(project_id=PROJECT_ID)),
    )
    monkeypatch.setattr(
        weekly_orchestrator, "DeepSeekClient", MagicMock(return_value=MagicMock())
    )
    monkeypatch.setattr(
        weekly_orchestrator, "KieClient", MagicMock(return_value=MagicMock())
    )

    outcome = await run_weekly_pipeline(
        bot=MagicMock(),
        pool=MagicMock(),
        project_id=PROJECT_ID,
        settings=FakeSettings(),
        target_monday=WEEK_START,
    )

    assert outcome.passes_run == 2
    assert outcome.all_ready is True
    assert outcome.ready_count == 7
    assert "item-2" in call_log
    # pass1: 7 drafts + pass2: 1 stuck draft
    assert prepare_mock.await_count == 8


@pytest.mark.asyncio
async def test_run_weekly_pipeline_marks_failed_on_exception(monkeypatch):
    """Exception в prepare_item → update_item_status(failed) с last_error."""
    pass1_items = [_item(0, post_type="pain", status="draft")]
    # После mark-failed pass2 увидит failed и попробует снова — отдаём ready snapshot
    after_mark = [
        ContentItemRecord(
            **{
                **pass1_items[0].__dict__,
                "status": "failed",
                "last_error": "RuntimeError: boom",
            }
        )
    ]
    final_items = [
        _item(0, post_type="pain", status="ready", final_text="t", image_url="u"),
        *[_item(i, post_type=f"t{i}", status="ready", final_text="t", image_url="u") for i in range(1, 7)],
    ]
    # list calls: pass1 start, pass2 start, final verify
    snapshots = iter([pass1_items, after_mark, after_mark, final_items])

    async def fake_list_plan_items(pool, plan_id):
        return next(snapshots)

    plan_record = ContentPlanRecord(
        id=PLAN_ID,
        project_id=PROJECT_ID,
        week_start=WEEK_START,
        week_end=WEEK_END,
        status="draft",
    )

    mark_mock = AsyncMock()
    prepare_calls = {"n": 0}

    async def prepare_side_effect(*args, **kwargs):
        prepare_calls["n"] += 1
        if prepare_calls["n"] == 1:
            raise RuntimeError("boom")
        return PreparationOutcome(
            item_id=kwargs["item"].id,
            status="ready",
            has_text=True,
            has_image=True,
            text_preview="ok",
            image_url="u",
            dedup_status="passed",
        )

    monkeypatch.setattr(weekly_orchestrator, "list_plan_items", fake_list_plan_items)
    monkeypatch.setattr(
        weekly_orchestrator,
        "build_week_plan",
        AsyncMock(return_value=WeekPlan(plan=plan_record, items=[])),
    )
    monkeypatch.setattr(
        weekly_orchestrator, "prepare_item", AsyncMock(side_effect=prepare_side_effect)
    )
    monkeypatch.setattr(weekly_orchestrator, "update_item_status", mark_mock)
    monkeypatch.setattr(
        weekly_orchestrator,
        "complete_image_for_item",
        AsyncMock(side_effect=AssertionError("не ожидается")),
    )
    monkeypatch.setattr(
        weekly_orchestrator,
        "ensure_default_brand_profile",
        AsyncMock(return_value=BrandProfile(project_id=PROJECT_ID)),
    )
    monkeypatch.setattr(
        weekly_orchestrator, "DeepSeekClient", MagicMock(return_value=MagicMock())
    )
    monkeypatch.setattr(
        weekly_orchestrator, "KieClient", MagicMock(return_value=MagicMock())
    )

    outcome = await run_weekly_pipeline(
        bot=MagicMock(),
        pool=MagicMock(),
        project_id=PROJECT_ID,
        settings=FakeSettings(),
        target_monday=WEEK_START,
    )

    mark_mock.assert_awaited()
    assert mark_mock.await_args.kwargs["status"] == "failed"
    assert "RuntimeError" in (mark_mock.await_args.kwargs["last_error"] or "")
    assert outcome.passes_run == 2
    assert outcome.ready_count == 7
    assert outcome.all_ready is True


@pytest.mark.asyncio
async def test_run_weekly_pipeline_two_passes_recovers_quality_and_text_ready(monkeypatch):
    """После pass1 остаются quality_failed и text_ready — pass2 должен их добить."""
    pass1_items = [
        _item(i, post_type=f"type{i}", status="draft")
        for i in range(7)
    ]
    after_pass1_items = [
        _item(0, post_type="type0", status="ready", final_text="t", image_url="u"),
        _item(1, post_type="type1", status="ready", final_text="t", image_url="u"),
        _item(2, post_type="type2", status="quality_failed", final_text="bad"),
        _item(3, post_type="type3", status="text_ready", final_text="ok"),
        _item(4, post_type="type4", status="ready", final_text="t", image_url="u"),
        _item(5, post_type="type5", status="ready", final_text="t", image_url="u"),
        _item(6, post_type="type6", status="ready", final_text="t", image_url="u"),
    ]
    final_items = [
        _item(0, post_type="type0", status="ready", final_text="t", image_url="u"),
        _item(1, post_type="type1", status="ready", final_text="t", image_url="u"),
        _item(2, post_type="type2", status="ready", final_text="ok2", image_url="u"),
        _item(3, post_type="type3", status="ready", final_text="ok", image_url="u"),
        _item(4, post_type="type4", status="ready", final_text="t", image_url="u"),
        _item(5, post_type="type5", status="ready", final_text="t", image_url="u"),
        _item(6, post_type="type6", status="ready", final_text="t", image_url="u"),
    ]
    snapshots = iter([pass1_items, after_pass1_items, after_pass1_items, final_items])

    async def fake_list_plan_items(pool, plan_id):
        assert plan_id == PLAN_ID
        return next(snapshots)

    plan_record = ContentPlanRecord(
        id=PLAN_ID,
        project_id=PROJECT_ID,
        week_start=WEEK_START,
        week_end=WEEK_END,
        status="draft",
    )

    async def fake_build_week_plan(pool, project_id, *, posts_per_week, target_monday):
        assert target_monday == WEEK_START
        return WeekPlan(plan=plan_record, items=[])

    prepare_mock = AsyncMock(
        return_value=PreparationOutcome(
            item_id="x",
            status="ready",
            has_text=True,
            has_image=True,
            text_preview="ok",
            image_url="u",
            dedup_status="passed",
        )
    )
    complete_image_mock = AsyncMock(
        return_value=PreparationOutcome(
            item_id="y",
            status="ready",
            has_text=True,
            has_image=True,
            text_preview="ok",
            image_url="u",
            dedup_status="passed",
        )
    )

    monkeypatch.setattr(weekly_orchestrator, "list_plan_items", fake_list_plan_items)
    monkeypatch.setattr(weekly_orchestrator, "build_week_plan", fake_build_week_plan)
    monkeypatch.setattr(weekly_orchestrator, "prepare_item", prepare_mock)
    monkeypatch.setattr(
        weekly_orchestrator, "complete_image_for_item", complete_image_mock
    )
    monkeypatch.setattr(
        weekly_orchestrator,
        "ensure_default_brand_profile",
        AsyncMock(return_value=BrandProfile(project_id=PROJECT_ID)),
    )
    monkeypatch.setattr(
        weekly_orchestrator, "DeepSeekClient", MagicMock(return_value=MagicMock())
    )
    monkeypatch.setattr(
        weekly_orchestrator, "KieClient", MagicMock(return_value=MagicMock())
    )

    settings = FakeSettings()

    outcome = await run_weekly_pipeline(
        bot=MagicMock(),
        pool=MagicMock(),
        project_id=PROJECT_ID,
        settings=settings,
        target_monday=WEEK_START,
    )

    assert outcome.passes_run == 2
    assert outcome.ready_count == 7
    assert outcome.all_ready is True
    assert outcome.items_total == 7
    assert prepare_mock.await_count == 7 + 1
    assert complete_image_mock.await_count == 1


@pytest.mark.asyncio
async def test_run_weekly_pipeline_marks_partial_when_problems_remain(monkeypatch):
    """Если после всех проходов остаются проблемы — outcome.all_ready=False и список проблем."""
    pass1_items = [_item(i, post_type=f"type{i}", status="draft") for i in range(7)]
    pass1_items[2] = _item(2, post_type="type2", status="draft")
    after_pass1_items = [
        _item(0, post_type="type0", status="ready", final_text="t", image_url="u"),
        _item(1, post_type="type1", status="ready", final_text="t", image_url="u"),
        _item(2, post_type="type2", status="quality_failed", final_text="bad"),
        _item(3, post_type="type3", status="ready", final_text="t", image_url="u"),
        _item(4, post_type="type4", status="ready", final_text="t", image_url="u"),
        _item(5, post_type="type5", status="ready", final_text="t", image_url="u"),
        _item(6, post_type="type6", status="ready", final_text="t", image_url="u"),
    ]
    final_items = list(after_pass1_items)
    snapshots = iter([pass1_items, after_pass1_items, after_pass1_items, final_items])

    async def fake_list_plan_items(pool, plan_id):
        return next(snapshots)

    plan_record = ContentPlanRecord(
        id=PLAN_ID,
        project_id=PROJECT_ID,
        week_start=WEEK_START,
        week_end=WEEK_END,
        status="draft",
    )

    async def fake_build_week_plan(pool, project_id, *, posts_per_week, target_monday):
        return WeekPlan(plan=plan_record, items=[])

    prepare_mock = AsyncMock(
        return_value=PreparationOutcome(
            item_id="x",
            status="quality_failed",
            has_text=True,
            has_image=False,
            text_preview="bad",
            image_url=None,
            dedup_status="passed",
        )
    )

    monkeypatch.setattr(weekly_orchestrator, "list_plan_items", fake_list_plan_items)
    monkeypatch.setattr(weekly_orchestrator, "build_week_plan", fake_build_week_plan)
    monkeypatch.setattr(weekly_orchestrator, "prepare_item", prepare_mock)
    monkeypatch.setattr(
        weekly_orchestrator,
        "complete_image_for_item",
        AsyncMock(side_effect=AssertionError("text_ready не должен вызываться")),
    )
    monkeypatch.setattr(
        weekly_orchestrator,
        "ensure_default_brand_profile",
        AsyncMock(return_value=BrandProfile(project_id=PROJECT_ID)),
    )
    monkeypatch.setattr(
        weekly_orchestrator, "DeepSeekClient", MagicMock(return_value=MagicMock())
    )
    monkeypatch.setattr(
        weekly_orchestrator, "KieClient", MagicMock(return_value=MagicMock())
    )

    settings = FakeSettings()
    outcome = await run_weekly_pipeline(
        bot=MagicMock(),
        pool=MagicMock(),
        project_id=PROJECT_ID,
        settings=settings,
        target_monday=WEEK_START,
    )

    assert outcome.all_ready is False
    assert outcome.ready_count == 6
    assert any(p.status == "quality_failed" for p in outcome.problem_items)


@pytest.mark.asyncio
async def test_run_weekly_pipeline_pass1_retries_existing_quality_failed(monkeypatch):
    """Ручной рестарт: quality_failed должен обрабатываться уже на pass1."""
    pass1_items = [
        _item(0, post_type="type0", status="ready", final_text="t", image_url="u"),
        _item(1, post_type="pain", status="quality_failed"),
        *[_item(i, post_type=f"type{i}", status="ready", final_text="t", image_url="u") for i in range(2, 7)],
    ]
    final_items = [
        _item(i, post_type=f"type{i}", status="ready", final_text="t", image_url="u")
        for i in range(7)
    ]
    # pass1 list, remaining check (all ready after pass1), final verify
    snapshots = iter([pass1_items, final_items, final_items])

    async def fake_list_plan_items(pool, plan_id):
        return next(snapshots)

    plan_record = ContentPlanRecord(
        id=PLAN_ID,
        project_id=PROJECT_ID,
        week_start=WEEK_START,
        week_end=WEEK_END,
        status="draft",
    )
    prepare_mock = AsyncMock(
        return_value=PreparationOutcome(
            item_id="item-1",
            status="ready",
            has_text=True,
            has_image=True,
            text_preview="ok",
            image_url="u",
            dedup_status="passed",
        )
    )
    monkeypatch.setattr(weekly_orchestrator, "list_plan_items", fake_list_plan_items)
    monkeypatch.setattr(
        weekly_orchestrator,
        "build_week_plan",
        AsyncMock(return_value=WeekPlan(plan=plan_record, items=[])),
    )
    monkeypatch.setattr(weekly_orchestrator, "prepare_item", prepare_mock)
    monkeypatch.setattr(
        weekly_orchestrator,
        "complete_image_for_item",
        AsyncMock(side_effect=AssertionError("не ожидается")),
    )
    monkeypatch.setattr(
        weekly_orchestrator,
        "ensure_default_brand_profile",
        AsyncMock(return_value=BrandProfile(project_id=PROJECT_ID)),
    )
    monkeypatch.setattr(
        weekly_orchestrator, "DeepSeekClient", MagicMock(return_value=MagicMock())
    )
    monkeypatch.setattr(
        weekly_orchestrator, "KieClient", MagicMock(return_value=MagicMock())
    )

    outcome = await run_weekly_pipeline(
        bot=MagicMock(),
        pool=MagicMock(),
        project_id=PROJECT_ID,
        settings=FakeSettings(),
        target_monday=WEEK_START,
    )

    assert prepare_mock.await_count == 1
    assert prepare_mock.await_args.kwargs["item"].status == "quality_failed"
    assert outcome.all_ready is True
    assert outcome.ready_count == 7
    assert outcome.passes_run == 1
