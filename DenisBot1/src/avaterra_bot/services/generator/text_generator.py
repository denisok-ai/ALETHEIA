"""
@file: text_generator.py
@description: Генерация текста поста с антидублями и логированием в prompts/integration_logs
@dependencies: deepseek client, deduplication, content repository
@created: 2026-05-07
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field

import asyncpg

from avaterra_bot.config import AppSettings
from avaterra_bot.db.repositories.brand import BrandProfile
from avaterra_bot.db.repositories.content import (
    ContentItemRecord,
    latest_published_texts,
    log_integration,
    log_prompt,
    update_item_text,
)
from avaterra_bot.services.deduplication import (
    DuplicateChecker,
    HistoricalFingerprint,
    build_minhash,
    extract_keywords,
    fingerprint,
)
from avaterra_bot.services.external.deepseek import DeepSeekClient, DeepSeekError
from avaterra_bot.services.generator.prompts import (
    GenerationRequest,
    build_text_prompts,
)
from avaterra_bot.services.quality.gates import QualityReport, evaluate_text

logger = logging.getLogger(__name__)


@dataclass
class TextGenerationOutcome:
    item_id: str
    text: str
    dry_run: bool
    dedup_status: str
    dedup_reason: str | None
    quality_passed: bool = True
    quality_codes: list[str] = field(default_factory=list)


@dataclass
class _DeepseekCallResult:
    text: str
    raw: dict
    model: str
    dry_run: bool
    latency_ms: int


async def _historical_fingerprints(
    pool: asyncpg.Pool, project_id: str, limit: int
) -> list[HistoricalFingerprint]:
    texts = await latest_published_texts(pool, project_id, limit=limit)
    return [
        HistoricalFingerprint(
            reference_id=str(idx),
            minhash=build_minhash(t),
            keywords=tuple(extract_keywords(t)),
        )
        for idx, t in enumerate(texts)
    ]


async def _call_deepseek_with_logging(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    settings: AppSettings,
    deepseek: DeepSeekClient,
    system_prompt: str,
    user_prompt: str,
    attempt_label: str,
) -> _DeepseekCallResult:
    request_id = uuid.uuid4().hex
    t0 = time.monotonic()
    try:
        result = await deepseek.chat(
            system_prompt=system_prompt, user_prompt=user_prompt
        )
    except DeepSeekError as exc:
        latency_ms = int((time.monotonic() - t0) * 1000)
        await log_prompt(
            pool,
            content_item_id=item.id,
            prompt_type=f"{item.post_type}_text_{attempt_label}",
            prompt_text=user_prompt,
            model_name=settings.deepseek_model,
            raw_response=None,
            latency_ms=latency_ms,
            status="error",
            error_code=str(exc)[:200],
        )
        await log_integration(
            pool,
            project_id=project_id,
            provider="deepseek",
            operation="chat.completions",
            request_id=request_id,
            status="error",
            latency_ms=latency_ms,
            error_code=str(exc)[:200],
            request_meta={
                "prompt_type": f"{item.post_type}_text",
                "attempt": attempt_label,
            },
            response_meta={},
        )
        raise

    latency_ms = result.latency_ms or int((time.monotonic() - t0) * 1000)
    await log_prompt(
        pool,
        content_item_id=item.id,
        prompt_type=f"{item.post_type}_text_{attempt_label}",
        prompt_text=user_prompt,
        model_name=result.model,
        raw_response=json.dumps(result.raw_response, ensure_ascii=False)[:8000],
        latency_ms=latency_ms,
        status="ok",
    )
    await log_integration(
        pool,
        project_id=project_id,
        provider="deepseek",
        operation="chat.completions",
        request_id=request_id,
        status="ok",
        latency_ms=latency_ms,
        error_code=None,
        request_meta={
            "prompt_type": f"{item.post_type}_text",
            "attempt": attempt_label,
        },
        response_meta={"model": result.model, "dry_run": result.dry_run},
    )
    return _DeepseekCallResult(
        text=result.text,
        raw=result.raw_response,
        model=result.model,
        dry_run=result.dry_run,
        latency_ms=latency_ms,
    )


async def _log_quality_outcome(
    pool: asyncpg.Pool,
    *,
    item: ContentItemRecord,
    report: QualityReport,
    attempt_label: str,
) -> None:
    if report.passed:
        return
    await log_prompt(
        pool,
        content_item_id=item.id,
        prompt_type=f"{item.post_type}_quality_{attempt_label}",
        prompt_text=report.feedback_for_retry()[:4000],
        model_name="quality_gates",
        raw_response=None,
        latency_ms=0,
        status="error",
        error_code=",".join(report.codes)[:200],
    )


async def generate_text_for_item(
    pool: asyncpg.Pool,
    *,
    project_id: str,
    item: ContentItemRecord,
    brand: BrandProfile,
    settings: AppSettings,
    deepseek: DeepSeekClient,
) -> TextGenerationOutcome:
    """Сгенерировать текст для `content_item` с quality gates и до 2 повторов."""
    request = GenerationRequest(
        post_type=item.post_type,
        topic=item.topic,
        objective=item.objective,
        outline=item.outline or "",
        cta=item.cta or "",
    )

    max_quality_retries = max(0, settings.quality_max_retries)
    quality_enabled = settings.quality_enabled
    feedback: str | None = None
    last_text = ""
    last_dry_run = False
    last_report: QualityReport | None = None

    for attempt in range(max_quality_retries + 1):
        attempt_label = f"attempt{attempt + 1}"
        request_for_attempt = GenerationRequest(
            post_type=request.post_type,
            topic=request.topic,
            objective=request.objective,
            outline=request.outline,
            cta=request.cta,
            audience_id=request.audience_id,
            rubric_id=request.rubric_id,
            feedback=feedback,
        )
        system_prompt, user_prompt = build_text_prompts(
            brand=brand, request=request_for_attempt
        )
        try:
            call = await _call_deepseek_with_logging(
                pool,
                project_id=project_id,
                item=item,
                settings=settings,
                deepseek=deepseek,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                attempt_label=attempt_label,
            )
        except DeepSeekError:
            await update_item_text(
                pool,
                item_id=item.id,
                generated_text="",
                final_text=None,
                status="failed",
            )
            raise

        last_text = call.text
        last_dry_run = call.dry_run

        if not quality_enabled or call.dry_run:
            break

        report = evaluate_text(
            text=call.text,
            topic=item.topic,
            post_type=item.post_type,
            brand=brand,
        )
        last_report = report
        await _log_quality_outcome(
            pool, item=item, report=report, attempt_label=attempt_label
        )
        if report.passed:
            break
        if attempt >= max_quality_retries:
            break
        feedback = report.feedback_for_retry()

    history = await _historical_fingerprints(
        pool, project_id, limit=settings.dedup_lookback_posts
    )
    candidate = fingerprint(last_text)
    checker = DuplicateChecker(
        jaccard_threshold=settings.dedup_jaccard_threshold,
        keyword_threshold=settings.dedup_keyword_overlap_threshold,
    )
    decision = checker.check(candidate, history)

    if decision.is_duplicate:
        await update_item_text(
            pool,
            item_id=item.id,
            generated_text=last_text,
            final_text=None,
            status="dedup_blocked",
            dedup_status="blocked",
            dedup_reason=decision.reason,
        )
        return TextGenerationOutcome(
            item_id=item.id,
            text=last_text,
            dry_run=last_dry_run,
            dedup_status="blocked",
            dedup_reason=decision.reason,
            quality_passed=last_report.passed if last_report else True,
            quality_codes=last_report.codes if last_report else [],
        )

    quality_passed = last_report.passed if last_report else True
    quality_codes = last_report.codes if last_report else []
    if quality_enabled and last_report is not None and not last_report.passed:
        await update_item_text(
            pool,
            item_id=item.id,
            generated_text=last_text,
            final_text=None,
            status="quality_failed",
            dedup_status="passed",
            dedup_reason=decision.reason,
        )
        return TextGenerationOutcome(
            item_id=item.id,
            text=last_text,
            dry_run=last_dry_run,
            dedup_status="passed",
            dedup_reason=decision.reason,
            quality_passed=False,
            quality_codes=quality_codes,
        )

    await update_item_text(
        pool,
        item_id=item.id,
        generated_text=last_text,
        final_text=last_text,
        status="text_ready",
        dedup_status="passed",
        dedup_reason=decision.reason,
    )
    return TextGenerationOutcome(
        item_id=item.id,
        text=last_text,
        dry_run=last_dry_run,
        dedup_status="passed",
        dedup_reason=decision.reason,
        quality_passed=quality_passed,
        quality_codes=quality_codes,
    )
