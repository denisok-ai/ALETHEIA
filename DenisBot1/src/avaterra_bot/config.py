"""
@file: config.py
@description: Загрузка и валидация настроек из переменных окружения
@dependencies: pydantic-settings
@created: 2026-05-07
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Глобальные настройки приложения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: str = Field(default="production")
    app_debug: bool = Field(default=False)
    timezone: str = Field(default="Europe/Moscow", alias="TZ")

    bot_token: SecretStr = Field(default=SecretStr(""), alias="BOT_TOKEN")
    webhook_base_url: str = Field(default="", alias="WEBHOOK_BASE_URL")
    webhook_secret_token: SecretStr = Field(
        default=SecretStr(""), alias="WEBHOOK_SECRET_TOKEN"
    )
    target_channel_id: str = Field(default="", alias="TARGET_CHANNEL_ID")
    admin_telegram_ids: str = Field(default="", alias="ADMIN_TELEGRAM_IDS")

    deepseak_api_key: SecretStr = Field(
        default=SecretStr(""), alias="DEEPSEAK_API_KEY"
    )
    deepseak_base_url: str = Field(
        default="https://api.deepseek.com", alias="DEEPSEAK_BASE_URL"
    )
    deepseek_model: str = Field(default="deepseek-chat", alias="DEEPSEEK_MODEL")
    deepseek_max_tokens: int = Field(default=1200, alias="DEEPSEEK_MAX_TOKENS")
    deepseek_temperature: float = Field(default=0.7, alias="DEEPSEEK_TEMPERATURE")

    kie_api_key: SecretStr = Field(default=SecretStr(""), alias="KIE_API_KEY")
    kie_base_url: str = Field(default="https://api.kie.ai", alias="KIE_BASE_URL")
    kie_model: str = Field(default="flux-kontext-pro", alias="KIE_MODEL")
    kie_image_size: str = Field(default="3:4", alias="KIE_IMAGE_SIZE")
    kie_poll_interval_seconds: float = Field(
        default=4.0, alias="KIE_POLL_INTERVAL_SECONDS"
    )
    kie_poll_timeout_seconds: float = Field(
        default=180.0, alias="KIE_POLL_TIMEOUT_SECONDS"
    )

    publish_hour: int = Field(default=11, alias="PUBLISH_HOUR")
    publish_minute: int = Field(default=0, alias="PUBLISH_MINUTE")
    publish_text_delay_seconds: float = Field(
        default=10.0, alias="PUBLISH_TEXT_DELAY_SECONDS"
    )
    enable_auto_publish: bool = Field(default=False, alias="ENABLE_AUTO_PUBLISH")
    dry_run: bool = Field(default=True, alias="DRY_RUN")
    weekly_planner_enabled: bool = Field(
        default=True, alias="WEEKLY_PLANNER_ENABLED"
    )

    database_url: str = Field(default="", alias="DATABASE_URL")
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")

    s3_endpoint: str = Field(default="", alias="S3_ENDPOINT")
    s3_region: str = Field(default="", alias="S3_REGION")
    s3_bucket: str = Field(default="", alias="S3_BUCKET")
    s3_access_key_id: SecretStr = Field(
        default=SecretStr(""), alias="S3_ACCESS_KEY_ID"
    )
    s3_secret_access_key: SecretStr = Field(
        default=SecretStr(""), alias="S3_SECRET_ACCESS_KEY"
    )

    scheduler_enabled: bool = Field(default=True, alias="SCHEDULER_ENABLED")
    content_generation_retry_max: int = Field(
        default=5, alias="CONTENT_GENERATION_RETRY_MAX"
    )
    content_generation_retry_base_ms: int = Field(
        default=1000, alias="CONTENT_GENERATION_RETRY_BASE_MS"
    )

    log_dir: Path = Field(default=Path("logs"), alias="LOG_DIR")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_retention_days: int = Field(default=14, alias="LOG_RETENTION_DAYS")

    dedup_lookback_posts: int = Field(default=60, alias="DEDUP_LOOKBACK_POSTS")
    dedup_jaccard_threshold: float = Field(
        default=0.55, alias="DEDUP_JACCARD_THRESHOLD"
    )
    dedup_keyword_overlap_threshold: float = Field(
        default=0.7, alias="DEDUP_KEYWORD_OVERLAP_THRESHOLD"
    )

    kb_yaml_path: Path = Field(
        default=Path("knowledge/avaterra.yaml"), alias="KB_YAML_PATH"
    )
    posts_per_week: int = Field(default=7, alias="POSTS_PER_WEEK")
    quality_max_retries: int = Field(default=2, alias="QUALITY_MAX_RETRIES")
    quality_enabled: bool = Field(default=True, alias="QUALITY_ENABLED")
    image_backup_enabled: bool = Field(default=True, alias="IMAGE_BACKUP_ENABLED")
    image_backup_dir: Path = Field(
        default=Path("/app/runtime/images"), alias="IMAGE_BACKUP_DIR"
    )

    @property
    def admin_ids(self) -> set[int]:
        if not self.admin_telegram_ids:
            return set()
        result: set[int] = set()
        for raw in self.admin_telegram_ids.split(","):
            raw = raw.strip()
            if raw.isdigit():
                result.add(int(raw))
        return result


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()
