-- @file: 008_funnel_and_stats.sql
-- @description: Расширения lead_events/lead_funnels и post_statistics для воронки и аналитики
-- @dependencies: 001_init.sql
-- @created: 2026-05-07

ALTER TABLE lead_funnels
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_funnels_slug
    ON lead_funnels (project_id, slug);

ALTER TABLE lead_events
    ADD COLUMN IF NOT EXISTS segment TEXT,
    ADD COLUMN IF NOT EXISTS source_item_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS username TEXT,
    ADD COLUMN IF NOT EXISTS first_name TEXT;

CREATE INDEX IF NOT EXISTS idx_lead_events_user_funnel
    ON lead_events (telegram_user_id, funnel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_segment_created
    ON lead_events (segment, created_at DESC);

ALTER TABLE post_statistics
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_post_stats_source
    ON post_statistics (source, collected_at DESC);

ALTER TABLE content_items
    ADD COLUMN IF NOT EXISTS tg_message_id BIGINT,
    ADD COLUMN IF NOT EXISTS tg_chat_id BIGINT;
