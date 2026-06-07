-- @file: 007_projects_unique_website.sql
-- @description: Запретить дубли проектов по website_url (защита от баг-цикла)
-- @dependencies: 001_init.sql
-- @created: 2026-05-07

CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_website_url
    ON projects (website_url);
