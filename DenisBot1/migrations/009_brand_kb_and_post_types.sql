-- @file: 009_brand_kb_and_post_types.sql
-- @description: Brand Knowledge Base поля + 7 типов постов (educational/pain/practice/author/faq/course/reflection) + audience/rubric/source в theme_pool
-- @dependencies: 001_init.sql, 005_theme_pool.sql
-- @created: 2026-05-07

ALTER TABLE brand_profiles
    ADD COLUMN IF NOT EXISTS audiences JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS author JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS rubrics JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS templates JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS cta_library JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS prohibited_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS safe_replacements JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS disclaimer JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS quick_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS text_whitelist JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS kb_version TEXT;

-- Расширяем enum типов постов в content_items.
ALTER TABLE content_items
    DROP CONSTRAINT IF EXISTS content_items_post_type_check;
ALTER TABLE content_items
    ADD CONSTRAINT content_items_post_type_check
    CHECK (post_type IN (
        'educational', 'pain', 'practice', 'author',
        'faq', 'course', 'reflection',
        'info', 'sales'
    ));

-- Расширяем enum типов в theme_pool под 7 новых + сохраняем старые info/sales.
ALTER TABLE theme_pool
    DROP CONSTRAINT IF EXISTS theme_pool_post_type_check;
ALTER TABLE theme_pool
    ADD CONSTRAINT theme_pool_post_type_check
    CHECK (post_type IN (
        'educational', 'pain', 'practice', 'author',
        'faq', 'course', 'reflection',
        'info', 'sales'
    ));

ALTER TABLE theme_pool
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS audience TEXT,
    ADD COLUMN IF NOT EXISTS rubric TEXT;

CREATE INDEX IF NOT EXISTS idx_theme_pool_project_type_status
    ON theme_pool (project_id, post_type, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_theme_pool_source
    ON theme_pool (source, status);
