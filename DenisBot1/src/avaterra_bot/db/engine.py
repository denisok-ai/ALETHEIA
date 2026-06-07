"""
@file: engine.py
@description: Пул подключений PostgreSQL через asyncpg
@dependencies: asyncpg
@created: 2026-05-07
"""

from __future__ import annotations

import logging
from typing import Optional

import asyncpg

from avaterra_bot.config import get_settings

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=10,
        command_timeout=30,
    )
    logger.info("postgres_pool_initialized")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("postgres_pool_closed")
