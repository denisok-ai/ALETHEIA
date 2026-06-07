-- @file: 004_site_signals.sql
-- @description: Site Radar - сигналы значимых изменений
-- @dependencies: 003_site_pages.sql
-- @created: 2026-05-07

CREATE TABLE IF NOT EXISTS site_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
    version_id UUID REFERENCES site_page_versions(id) ON DELETE SET NULL,
    signal_type TEXT NOT NULL,
    change_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
    score INT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'accepted', 'rejected', 'applied')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_site_signals_project_status_score
    ON site_signals (project_id, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_site_signals_page_created
    ON site_signals (page_id, created_at DESC);
