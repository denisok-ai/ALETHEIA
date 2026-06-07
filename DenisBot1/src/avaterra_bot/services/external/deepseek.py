"""
@file: deepseek.py
@description: Клиент DeepSeek Chat API c retry, timeout, dry-run и логированием
@dependencies: aiohttp, tenacity
@created: 2026-05-07
"""

from __future__ import annotations

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
class ChatResult:
    text: str
    raw_response: dict
    latency_ms: int
    model: str
    dry_run: bool = False


class DeepSeekError(Exception):
    """Ошибка работы с DeepSeek API."""


class DeepSeekClient:
    """Минимальный совместимый с OpenAI/DeepSeek клиент чат-комплитов."""

    def __init__(self, settings: AppSettings) -> None:
        self._settings = settings
        self._timeout = aiohttp.ClientTimeout(total=60, connect=10)

    async def chat(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> ChatResult:
        """Выполнить chat completion. В dry-run возвращает шаблонный ответ."""
        api_key = self._settings.deepseak_api_key.get_secret_value()
        model = self._settings.deepseek_model
        if not api_key or self._settings.dry_run:
            logger.info(
                "deepseek_dry_run",
                extra={"reason": "no_key" if not api_key else "dry_run"},
            )
            return self._dry_run_result(user_prompt)

        url = f"{self._settings.deepseak_base_url.rstrip('/')}/chat/completions"
        body = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": (
                temperature
                if temperature is not None
                else self._settings.deepseek_temperature
            ),
            "max_tokens": max_tokens or self._settings.deepseek_max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        async def _do_call() -> ChatResult:
            t0 = time.monotonic()
            async with aiohttp.ClientSession(timeout=self._timeout) as session:
                async with session.post(url, headers=headers, json=body) as resp:
                    text_body = await resp.text()
                    latency_ms = int((time.monotonic() - t0) * 1000)
                    if resp.status >= 500 or resp.status == 429:
                        raise DeepSeekError(
                            f"deepseek transient {resp.status}: {text_body[:200]}"
                        )
                    if resp.status >= 400:
                        raise DeepSeekError(
                            f"deepseek error {resp.status}: {text_body[:200]}"
                        )
                    payload = await resp.json(content_type=None)
            choice = (payload.get("choices") or [{}])[0]
            message = choice.get("message") or {}
            content = (message.get("content") or "").strip()
            if not content:
                raise DeepSeekError("deepseek empty content")
            return ChatResult(
                text=content,
                raw_response=payload,
                latency_ms=latency_ms,
                model=model,
            )

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self._settings.content_generation_retry_max),
            wait=wait_exponential_jitter(initial=1, max=20),
            retry=retry_if_exception_type((DeepSeekError, aiohttp.ClientError)),
            reraise=True,
        ):
            with attempt:
                return await _do_call()
        raise DeepSeekError("unreachable")

    def _dry_run_result(self, user_prompt: str) -> ChatResult:
        marker = user_prompt[:80].replace("\n", " ")
        text = (
            "[dry-run] Заглушка текста поста.\n"
            f"Промпт: {marker}...\n"
            "Подставится реальный DeepSeek-ответ при включении DRY_RUN=false и наличии ключа."
        )
        return ChatResult(
            text=text,
            raw_response={"dry_run": True},
            latency_ms=0,
            model=self._settings.deepseek_model,
            dry_run=True,
        )
