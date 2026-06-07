"""
@file: logging_setup.py
@description: Структурное логирование, ротация по дням, маскирование секретов
@dependencies: python-json-logger
@created: 2026-05-07
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import re
from pathlib import Path

from pythonjsonlogger import jsonlogger

from avaterra_bot.config import AppSettings, get_settings

SECRET_KEYS = (
    "authorization",
    "api_key",
    "apikey",
    "token",
    "bot_token",
    "password",
    "secret",
    "x-telegram-bot-api-secret-token",
)
SECRET_VALUE_PATTERNS = (
    re.compile(r"(sk-[A-Za-z0-9]{16,})"),
    re.compile(r"(\d{8,12}:[A-Za-z0-9_-]{20,})"),
    re.compile(r"(Bearer\s+[A-Za-z0-9._\-]+)", re.IGNORECASE),
)
MASK = "***"


def _mask_value(value: str) -> str:
    masked = value
    for pattern in SECRET_VALUE_PATTERNS:
        masked = pattern.sub(MASK, masked)
    return masked


class SecretMaskingFilter(logging.Filter):
    """Маскирует секреты в сообщениях и атрибутах записи."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _mask_value(record.msg)
        if record.args:
            try:
                record.args = tuple(
                    _mask_value(a) if isinstance(a, str) else a for a in record.args
                )
            except Exception:
                pass
        for key in list(record.__dict__.keys()):
            if key.lower() in SECRET_KEYS:
                record.__dict__[key] = MASK
            else:
                value = record.__dict__[key]
                if isinstance(value, str):
                    record.__dict__[key] = _mask_value(value)
        return True


def _build_formatter() -> jsonlogger.JsonFormatter:
    return jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
    )


def setup_logging(settings: AppSettings | None = None) -> None:
    """Настроить корневой логгер: stdout + файл с ротацией по суткам."""
    settings = settings or get_settings()
    log_dir: Path = Path(settings.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    formatter = _build_formatter()
    secret_filter = SecretMaskingFilter()

    root = logging.getLogger()
    root.setLevel(level)
    for handler in list(root.handlers):
        root.removeHandler(handler)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)
    stream_handler.addFilter(secret_filter)
    root.addHandler(stream_handler)

    file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=str(log_dir / "app.log"),
        when="midnight",
        interval=1,
        backupCount=settings.log_retention_days,
        encoding="utf-8",
        utc=False,
    )
    file_handler.suffix = "%Y-%m-%d"
    file_handler.setFormatter(formatter)
    file_handler.addFilter(secret_filter)
    root.addHandler(file_handler)

    for noisy in ("aiogram.event", "aiogram.dispatcher", "asyncio"):
        logging.getLogger(noisy).setLevel(
            logging.INFO if level <= logging.INFO else level
        )

    logging.captureWarnings(True)
    root.info(
        "logging_initialized",
        extra={
            "log_dir": str(log_dir),
            "log_level": settings.log_level,
            "retention_days": settings.log_retention_days,
            "pid": os.getpid(),
        },
    )
