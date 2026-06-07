-- @file: 002_content_fingerprints.sql
-- @description: Хранилище MinHash-сигнатур и ключевых слов для антидублей контента
-- @dependencies: 001_init.sql
-- @created: 2026-05-07

CREATE TABLE IF NOT EXISTS content_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    minhash BYTEA NOT NULL,
    num_perm INT NOT NULL DEFAULT 128,
    shingle_size INT NOT NULL DEFAULT 5,
    keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    normalized_length INT NOT NULL DEFAULT 0,
    text_sha256 BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, text_sha256)
);

CREATE INDEX IF NOT EXISTS idx_fingerprints_project_created
    ON content_fingerprints (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fingerprints_keywords_gin
    ON content_fingerprints USING GIN (keywords);

ALTER TABLE content_items
    ADD COLUMN IF NOT EXISTS dedup_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS dedup_reason TEXT,
    ADD COLUMN IF NOT EXISTS dedup_match_id UUID;

CREATE INDEX IF NOT EXISTS idx_content_items_dedup_status
    ON content_items (dedup_status);
