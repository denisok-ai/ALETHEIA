"""
@file: kie.py
@description: Клиент KIE Flux Kontext API: POST /api/v1/flux/kontext/generate + polling record-info
@dependencies: aiohttp, tenacity
@created: 2026-05-07
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional

import aiohttp
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from avaterra_bot.config import AppSettings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ImageResult:
    image_url: str
    task_id: str
    raw_response: dict
    latency_ms: int
    model: str
    dry_run: bool = False


class KieError(Exception):
    """Ошибка работы с KIE API."""


class KieClient:
    """Async-клиент для KIE Flux Kontext: создает задачу и опрашивает её статус."""

    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._timeout = aiohttp.ClientTimeout(total=60, connect=10)

    async def generate_image(
        self,
        *,
        prompt: str,
        size: Optional[str] = None,
    ) -> ImageResult:
        api_key = self._settings.kie_api_key.get_secret_value()
        model = self._settings.kie_model
        if not api_key or self._settings.dry_run:
            logger.info(
                "kie_dry_run",
                extra={"reason": "no_key" if not api_key else "dry_run"},
            )
            return self._dry_run_result(prompt)

        base = self._settings.kie_base_url.rstrip("/")
        create_url = f"{base}/api/v1/flux/kontext/generate"
        details_url = f"{base}/api/v1/flux/kontext/record-info"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        body = {
            "prompt": prompt,
            "aspectRatio": size or self._settings.kie_image_size,
            "model": model,
            "outputFormat": "jpeg",
            "enableTranslation": True,
            "promptUpsampling": False,
            "safetyTolerance": 2,
        }

        t0 = time.monotonic()
        async with aiohttp.ClientSession(timeout=self._timeout) as session:
            task_id = await self._create_task(session, create_url, headers, body)
            image_url = await self._poll_task(session, details_url, headers, task_id)
        latency_ms = int((time.monotonic() - t0) * 1000)
        return ImageResult(
            image_url=image_url,
            task_id=task_id,
            raw_response={"task_id": task_id, "image_url": image_url},
            latency_ms=latency_ms,
            model=model,
        )

    async def _create_task(
        self,
        session: aiohttp.ClientSession,
        url: str,
        headers: dict,
        body: dict,
    ) -> str:
        async def _call() -> str:
            async with session.post(url, headers=headers, json=body) as resp:
                text_body = await resp.text()
                if resp.status >= 500 or resp.status == 429:
                    raise KieError(
                        f"kie create transient {resp.status}: {text_body[:200]}"
                    )
                if resp.status >= 400:
                    raise KieError(
                        f"kie create error {resp.status}: {text_body[:200]}"
                    )
                payload = await resp.json(content_type=None)
            code = payload.get("code")
            if code is not None and int(code) != 200:
                raise KieError(
                    f"kie create code={code} msg={payload.get('msg')}"
                )
            data = payload.get("data") or {}
            task_id = data.get("taskId") or data.get("task_id") or payload.get("taskId")
            if not task_id:
                raise KieError(f"kie create returned no taskId: {payload}")
            return str(task_id)

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self._settings.content_generation_retry_max),
            wait=wait_exponential_jitter(initial=1, max=20),
            retry=retry_if_exception_type((KieError, aiohttp.ClientError)),
            reraise=True,
        ):
            with attempt:
                return await _call()
        raise KieError("unreachable")

    async def _poll_task(
        self,
        session: aiohttp.ClientSession,
        details_url: str,
        headers: dict,
        task_id: str,
    ) -> str:
        deadline = time.monotonic() + self._settings.kie_poll_timeout_seconds
        params = {"taskId": task_id}
        while time.monotonic() < deadline:
            async with session.get(details_url, headers=headers, params=params) as resp:
                text_body = await resp.text()
                if resp.status >= 500 or resp.status == 429:
                    await asyncio.sleep(self._settings.kie_poll_interval_seconds)
                    continue
                if resp.status >= 400:
                    raise KieError(
                        f"kie poll error {resp.status}: {text_body[:200]}"
                    )
                payload = await resp.json(content_type=None)
            data = payload.get("data") or {}
            success_flag = data.get("successFlag")
            if success_flag == 1:
                response = data.get("response") or {}
                image_url = response.get("resultImageUrl") or response.get(
                    "originImageUrl"
                )
                images_list = response.get("resultImageUrls") or []
                if not image_url and images_list:
                    image_url = images_list[0]
                if not image_url:
                    raise KieError(f"kie success without image url: {payload}")
                return image_url
            if success_flag in (2, 3):
                err_msg = data.get("errorMessage") or "unknown"
                err_code = data.get("errorCode")
                raise KieError(
                    f"kie task failed (flag={success_flag}, code={err_code}): {err_msg}"
                )
            await asyncio.sleep(self._settings.kie_poll_interval_seconds)
        raise KieError("kie poll timeout")

    def _dry_run_result(self, prompt: str) -> ImageResult:
        return ImageResult(
            image_url="https://placehold.co/1200x1500/png?text=%D0%90%D0%B2%D0%B0%D1%82%D1%8D%D1%80%D1%80%D0%B0%20dry-run",
            task_id="dry-run",
            raw_response={"dry_run": True, "prompt": prompt[:120]},
            latency_ms=0,
            model=self._settings.kie_model,
            dry_run=True,
        )
