"""
@file: image_backup.py
@description: Бэкап картинок KIE: скачать и сохранить в S3 или локально, чтобы публикация не зависела от 14-дневной ссылки KIE
@dependencies: aiohttp, boto3, avaterra_bot.config
@created: 2026-05-07
"""

from __future__ import annotations

import logging
import mimetypes
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

import aiohttp

from avaterra_bot.config import AppSettings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BackupResult:
    backup_url: str
    storage: str  # 's3' | 'local'
    local_path: Optional[Path] = None


class ImageBackupError(Exception):
    """Ошибка скачивания/выгрузки backup-картинки."""


async def backup_image(
    *,
    item_id: str,
    source_url: str,
    settings: AppSettings,
) -> Optional[BackupResult]:
    """Скачать KIE-картинку и сохранить рядом со статусом для долговечной публикации."""
    if not settings.image_backup_enabled:
        return None
    if not source_url or source_url.startswith("file://") or source_url.startswith("s3://"):
        return None
    try:
        payload, content_type = await _download_image(source_url)
    except Exception as exc:
        raise ImageBackupError(f"download_failed: {exc}") from exc

    extension = _extension_from_content_type(content_type)
    if _has_s3_credentials(settings):
        return await _store_s3(
            payload=payload,
            content_type=content_type,
            extension=extension,
            item_id=item_id,
            settings=settings,
        )
    return _store_local(
        payload=payload,
        item_id=item_id,
        extension=extension,
        settings=settings,
    )


async def _download_image(url: str) -> tuple[bytes, str]:
    timeout = aiohttp.ClientTimeout(total=60, connect=15)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url) as resp:
            resp.raise_for_status()
            payload = await resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg").split(";")[0]
            return payload, content_type


def _extension_from_content_type(content_type: str) -> str:
    if not content_type:
        return ".jpg"
    guess = mimetypes.guess_extension(content_type)
    if not guess or guess == ".jpe":
        return ".jpg"
    return guess


def _has_s3_credentials(settings: AppSettings) -> bool:
    return bool(
        settings.s3_bucket
        and settings.s3_endpoint
        and settings.s3_access_key_id.get_secret_value()
        and settings.s3_secret_access_key.get_secret_value()
    )


def _store_local(
    *,
    payload: bytes,
    item_id: str,
    extension: str,
    settings: AppSettings,
) -> BackupResult:
    backup_dir = Path(settings.image_backup_dir)
    backup_dir.mkdir(parents=True, exist_ok=True)
    file_path = backup_dir / f"{item_id}{extension}"
    file_path.write_bytes(payload)
    return BackupResult(
        backup_url=f"file://{file_path}",
        storage="local",
        local_path=file_path,
    )


async def _store_s3(
    *,
    payload: bytes,
    content_type: str,
    extension: str,
    item_id: str,
    settings: AppSettings,
) -> BackupResult:
    try:
        import boto3  # type: ignore
        from botocore.config import Config  # type: ignore
    except Exception as exc:  # pragma: no cover - boto3 в проде есть
        raise ImageBackupError(f"boto3 unavailable: {exc}") from exc

    today = date.today()
    key = f"avaterra/images/{today.year:04d}/{today.month:02d}/{item_id}{extension}"
    config = Config(signature_version="s3v4")
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region or None,
        aws_access_key_id=settings.s3_access_key_id.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_access_key.get_secret_value(),
        config=config,
    )
    s3.put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=payload,
        ContentType=content_type or "image/jpeg",
    )
    backup_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=60 * 60 * 24 * 30,
    )
    return BackupResult(backup_url=backup_url, storage="s3")
