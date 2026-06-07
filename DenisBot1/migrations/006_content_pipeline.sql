-- @file: 006_content_pipeline.sql
-- @description: Расширение content_items для генерации/публикации, привязка к theme_pool
-- @dependencies: 001_init.sql, 005_theme_pool.sql
-- @created: 2026-05-07

ALTER TABLE content_items
    ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES theme_pool(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS image_prompt TEXT,
    ADD COLUMN IF NOT EXISTS image_task_id TEXT,
    ADD COLUMN IF NOT EXISTS dedup_status TEXT,
    ADD COLUMN IF NOT EXISTS dedup_reason TEXT,
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_content_items_publish_status
    ON content_items (publish_date, status);
CREATE INDEX IF NOT EXISTS idx_content_items_theme
    ON content_items (theme_id);

ALTER TABLE prompts
    ADD COLUMN IF NOT EXISTS latency_ms INT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ok',
    ADD COLUMN IF NOT EXISTS error_code TEXT;

ALTER TABLE integration_logs
    ADD COLUMN IF NOT EXISTS request_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS response_meta JSONB NOT NULL DEFAULT '{}'::jsonb;
