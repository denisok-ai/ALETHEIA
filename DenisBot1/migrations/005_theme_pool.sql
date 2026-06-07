-- @file: 005_theme_pool.sql
-- @description: Site Radar - очередь идей контента
-- @dependencies: 004_site_signals.sql
-- @created: 2026-05-07

CREATE TABLE IF NOT EXISTS theme_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    angle TEXT,
    post_type TEXT NOT NULL CHECK (post_type IN ('info', 'sales')),
    priority INT NOT NULL DEFAULT 50,
    source_signal_id UUID REFERENCES site_signals(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'scheduled', 'used', 'dropped')),
    not_before DATE,
    expires_at DATE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_pool_project_status_priority
    ON theme_pool (project_id, status, priority DESC, created_at DESC);
