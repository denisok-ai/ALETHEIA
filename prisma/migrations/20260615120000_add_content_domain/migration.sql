-- CreateTable: SMM / Site Radar content domain
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "kbVersion" TEXT,
    "dataJson" TEXT NOT NULL,
    "toneOfVoice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ContentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "weekEnd" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ThemePool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "postType" TEXT NOT NULL DEFAULT 'educational',
    "audience" TEXT,
    "rubric" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'kb',
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT,
    "publishDate" DATETIME NOT NULL,
    "postType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "objective" TEXT,
    "outline" TEXT,
    "cta" TEXT,
    "themeId" TEXT,
    "audience" TEXT,
    "rubric" TEXT,
    "generatedText" TEXT,
    "finalText" TEXT,
    "imageUrl" TEXT,
    "imageUrlBackup" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "qualityIssues" TEXT,
    "dedupSignature" TEXT,
    "dedupKeywords" TEXT,
    "telegramMsgId" INTEGER,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContentItem_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "ThemePool" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SitePage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SitePageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "normalizedJson" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SiteSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT,
    "signalType" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "severity" TEXT NOT NULL DEFAULT 'low',
    "summary" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteSignal_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "SitePage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PostStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentItemId" TEXT,
    "telegramMsgId" INTEGER,
    "channelId" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "forwards" INTEGER NOT NULL DEFAULT 0,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "rawPayload" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PostStat_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BrandProfile_slug_key" ON "BrandProfile"("slug");
CREATE INDEX "ContentPlan_weekStart_idx" ON "ContentPlan"("weekStart");
CREATE UNIQUE INDEX "ThemePool_source_topic_key" ON "ThemePool"("source", "topic");
CREATE INDEX "ThemePool_status_idx" ON "ThemePool"("status");
CREATE INDEX "ThemePool_postType_idx" ON "ThemePool"("postType");
CREATE INDEX "ContentItem_publishDate_idx" ON "ContentItem"("publishDate");
CREATE INDEX "ContentItem_status_idx" ON "ContentItem"("status");
CREATE INDEX "ContentItem_planId_idx" ON "ContentItem"("planId");
CREATE UNIQUE INDEX "SitePage_url_key" ON "SitePage"("url");
CREATE INDEX "SitePageVersion_pageId_fetchedAt_idx" ON "SitePageVersion"("pageId", "fetchedAt");
CREATE INDEX "SiteSignal_createdAt_idx" ON "SiteSignal"("createdAt");
CREATE INDEX "SiteSignal_severity_idx" ON "SiteSignal"("severity");
CREATE INDEX "SiteSignal_status_idx" ON "SiteSignal"("status");
CREATE INDEX "PostStat_contentItemId_idx" ON "PostStat"("contentItemId");
CREATE INDEX "PostStat_telegramMsgId_idx" ON "PostStat"("telegramMsgId");
