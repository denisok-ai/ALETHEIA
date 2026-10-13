-- Соцсети «один материал → все площадки» (T3.1) и сквозной учёт ссылок ?ref= (T3.3).
--
-- Только новые таблицы и ADD COLUMN: существующие таблицы не пересоздаются.
-- (Prisma при генерации предлагает пересоздать Lead, Order-связанные и др. — это
-- дрейф старых миграций относительно schema.prisma, в эту миграцию он не входит.)
--
-- acqRef — метка ?ref= с сайта (cookie av_ref, первое касание) на момент создания
-- лида или заказа. Order.userId этой миграцией не затрагивается.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "acqRef" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "acqRef" TEXT;

-- CreateTable
CREATE TABLE "SocialNetwork" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'ready_post',
    "profileUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "mediaPath" TEXT,
    "sourceUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemId" INTEGER NOT NULL,
    "networkCode" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "refCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "externalId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialPost_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SocialItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SocialRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialLinkEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "refCode" TEXT NOT NULL,
    "networkCode" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialNetwork_code_key" ON "SocialNetwork"("code");

-- CreateIndex
CREATE INDEX "SocialItem_status_idx" ON "SocialItem"("status");

-- CreateIndex
CREATE INDEX "SocialItem_kind_idx" ON "SocialItem"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_itemId_networkCode_key" ON "SocialPost"("itemId", "networkCode");

-- CreateIndex
CREATE INDEX "SocialPost_status_scheduledAt_idx" ON "SocialPost"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "SocialPost_refCode_idx" ON "SocialPost"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "SocialRule_key_key" ON "SocialRule"("key");

-- CreateIndex
CREATE INDEX "SocialLinkEvent_refCode_idx" ON "SocialLinkEvent"("refCode");

-- CreateIndex
CREATE INDEX "SocialLinkEvent_createdAt_idx" ON "SocialLinkEvent"("createdAt");
