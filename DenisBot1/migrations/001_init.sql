-- @file: 001_init.sql
-- @description: Инициализация схемы БД для Avaterra Telegram SMM Bot (MVP)
-- @dependencies: PostgreSQL 14+
-- @created: 2026-05-07

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    niche TEXT,
    website_url TEXT NOT NULL,
    channel_id BIGINT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_profiles (
    project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    tone_of_voice TEXT NOT NULL DEFAULT '',
    style_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    prohibited_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_audience JSONB NOT NULL DEFAULT '{}'::jsonb,
    goals JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    url TEXT,
    title TEXT,
    content TEXT,
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sources_project_extracted
    ON sources (project_id, extracted_at DESC);

CREATE TABLE IF NOT EXISTS content_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, week_start)
);

CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES content_plans(id) ON DELETE CASCADE,
    publish_date DATE NOT NULL,
    post_type TEXT NOT NULL CHECK (post_type IN ('info', 'sales')),
    topic TEXT NOT NULL,
    objective TEXT NOT NULL,
    outline TEXT,
    cta TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    generated_text TEXT,
    final_text TEXT,
    image_url TEXT,
    approved_by BIGINT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, publish_date, post_type)
);
CREATE INDEX IF NOT EXISTS idx_content_items_plan_publish
    ON content_items (plan_id, publish_date);
CREATE INDEX IF NOT EXISTS idx_content_items_status
    ON content_items (status);

CREATE TABLE IF NOT EXISTS post_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    views INT NOT NULL DEFAULT 0,
    reactions INT NOT NULL DEFAULT 0,
    ctr NUMERIC(5,2) NOT NULL DEFAULT 0,
    comments INT NOT NULL DEFAULT 0,
    saves INT NOT NULL DEFAULT 0,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_stats_item_collected
    ON post_statistics (content_item_id, collected_at DESC);

CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    prompt_type TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    model_name TEXT NOT NULL,
    raw_response TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prompts_item_type_created
    ON prompts (content_item_id, prompt_type, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES lead_funnels(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    step TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_events_funnel_created
    ON lead_events (funnel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS publication_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_next_retry
    ON publication_jobs (status, next_retry_at);

CREATE TABLE IF NOT EXISTS integration_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    request_id TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INT,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_logs_provider_created
    ON integration_logs (provider, created_at DESC);
