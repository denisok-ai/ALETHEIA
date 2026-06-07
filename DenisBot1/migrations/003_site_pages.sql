-- @file: 003_site_pages.sql
-- @description: Site Radar - страницы и их версии
-- @dependencies: 001_init.sql
-- @created: 2026-05-07

CREATE TABLE IF NOT EXISTS site_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    last_status INT,
    last_etag TEXT,
    last_modified_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    last_content_hash BYTEA,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, url)
);

CREATE INDEX IF NOT EXISTS idx_site_pages_project_active
    ON site_pages (project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_site_pages_category
    ON site_pages (category);

CREATE TABLE IF NOT EXISTS site_page_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    http_status INT NOT NULL,
    content_hash BYTEA NOT NULL,
    cleaned_text TEXT,
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_site_page_versions_page_fetched
    ON site_page_versions (page_id, fetched_at DESC);
