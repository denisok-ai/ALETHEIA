-- SEO-метрики и журнал синков (T1.1, docs/Plan-SEO-Social-2026-10.md).
--
-- Только новые таблицы и индексы: существующие таблицы не трогаются.
--   SeoMetric  — ежедневные цифры источников (gsc, metrika, webmaster); source входит в ключ;
--   SeoSyncRun — журнал прогонов синка: последний прогон по source для сторожа и страницы SEO.

-- CreateTable
CREATE TABLE "SeoMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "host" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "measure" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeoSyncRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "state" TEXT NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "dateFrom" TEXT,
    "dateTo" TEXT,
    "message" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoMetric_host_source_date_dimension_key_measure_key" ON "SeoMetric"("host", "source", "date", "dimension", "key", "measure");

-- CreateIndex
CREATE INDEX "SeoMetric_source_dimension_date_idx" ON "SeoMetric"("source", "dimension", "date");

-- CreateIndex
CREATE INDEX "SeoSyncRun_source_startedAt_idx" ON "SeoSyncRun"("source", "startedAt");
