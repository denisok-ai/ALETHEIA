"""
@file: http_client.py
@description: HTTP-клиент Site Radar c rate-limit, ETag-кешем и общим User-Agent
@dependencies: aiohttp, tenacity
@created: 2026-05-07
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

import aiohttp
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = "AvaterraSiteRadar/1.0 (+https://avaterra.pro)"
DEFAULT_TIMEOUT = aiohttp.ClientTimeout(total=20, connect=10)
DEFAULT_RPS = 1.0
DEFAULT_MAX_PARALLEL = 5


@dataclass
class FetchResult:
    """Результат загрузки страницы."""

    url: str
    status: int
    text: str
    etag: Optional[str]
    last_modified: Optional[str]
    not_modified: bool = False


class RateLimiter:
    """Простой токен-бакет на основе минимального интервала между вызовами."""

    def __init__(self, rps: float) -> None:
        if rps <= 0:
            raise ValueError("rps must be positive")
        self._interval = 1.0 / rps
        self._lock = asyncio.Lock()
        self._next_at = 0.0

    async def acquire(self) -> None:
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            wait = self._next_at - now
            if wait > 0:
                await asyncio.sleep(wait)
                now = loop.time()
            self._next_at = max(now, self._next_at) + self._interval


class SiteRadarHttpClient:
    """HTTP-клиент c rate limit, conditional GET и ретраями."""

    def __init__(
        self,
        user_agent: str = DEFAULT_USER_AGENT,
        rps: float = DEFAULT_RPS,
        max_parallel: int = DEFAULT_MAX_PARALLEL,
        timeout: aiohttp.ClientTimeout | None = None,
        max_retries: int = 3,
    ) -> None:
        self._user_agent = user_agent
        self._rate_limiter = RateLimiter(rps)
        self._semaphore = asyncio.Semaphore(max_parallel)
        self._timeout = timeout or DEFAULT_TIMEOUT
        self._max_retries = max_retries
        self._session: Optional[aiohttp.ClientSession] = None

    async def __aenter__(self) -> "SiteRadarHttpClient":
        self._session = aiohttp.ClientSession(
            headers={"User-Agent": self._user_agent, "Accept": "text/html,*/*;q=0.5"},
            timeout=self._timeout,
        )
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None:
            raise RuntimeError("http client must be used inside `async with` block")
        return self._session

    async def fetch(
        self,
        url: str,
        etag: str | None = None,
        last_modified: str | None = None,
    ) -> FetchResult:
        """Загрузить URL c respect rate limit и conditional GET."""
        session = self._ensure_session()
        headers: dict[str, str] = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        async def _do_request() -> FetchResult:
            await self._rate_limiter.acquire()
            async with self._semaphore:
                async with session.get(url, headers=headers, allow_redirects=True) as resp:
                    status = resp.status
                    if status == 304:
                        return FetchResult(
                            url=str(resp.url),
                            status=status,
                            text="",
                            etag=resp.headers.get("ETag"),
                            last_modified=resp.headers.get("Last-Modified"),
                            not_modified=True,
                        )
                    if status >= 500 or status == 429:
                        body = await resp.text(errors="ignore")
                        raise aiohttp.ClientResponseError(
                            request_info=resp.request_info,
                            history=resp.history,
                            status=status,
                            message=body[:200],
                            headers=resp.headers,
                        )
                    text = await resp.text(errors="ignore")
                    return FetchResult(
                        url=str(resp.url),
                        status=status,
                        text=text,
                        etag=resp.headers.get("ETag"),
                        last_modified=resp.headers.get("Last-Modified"),
                        not_modified=False,
                    )

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=1, max=15),
            retry=retry_if_exception_type(
                (aiohttp.ClientError, aiohttp.ServerTimeoutError, asyncio.TimeoutError)
            ),
            reraise=True,
        ):
            with attempt:
                result = await _do_request()
                logger.info(
                    "site_radar_fetch",
                    extra={
                        "url": url,
                        "status": result.status,
                        "not_modified": result.not_modified,
                    },
                )
                return result
        raise RuntimeError("unreachable")
