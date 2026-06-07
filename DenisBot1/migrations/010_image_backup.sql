-- @file: 010_image_backup.sql
-- @description: Локальный/S3-бэкап картинок KIE для долговечной публикации
-- @dependencies: 001_init.sql
-- @created: 2026-05-07

ALTER TABLE content_items
    ADD COLUMN IF NOT EXISTS image_url_backup TEXT,
    ADD COLUMN IF NOT EXISTS image_backup_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_content_items_image_backup_status
    ON content_items (image_backup_status);
