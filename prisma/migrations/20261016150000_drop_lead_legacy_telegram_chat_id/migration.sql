-- Удаление Lead.telegramChatId (INTEGER, до 23.09.2026): значения продублированы в telegramChatIdBig,
-- в коде не используется. Сверка на проде 16.10.2026: 2 строки, расхождений 0. Решение владельца 16.10.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT,
    "convertedToUserId" TEXT,
    "lastOrderNumber" TEXT,
    "telegramChatIdBig" BIGINT,
    "telegramUsername" TEXT,
    "funnelSegment" TEXT,
    "entrySource" TEXT,
    "acqRef" TEXT,
    "followupStage" INTEGER NOT NULL DEFAULT 0,
    "lastBotMessageAt" DATETIME,
    "respondedAt" DATETIME,
    "qualifiedAt" DATETIME,
    "qualifyReason" TEXT,
    "buyIntentAt" DATETIME,
    "nurtureStage" INTEGER NOT NULL DEFAULT 0,
    "lastNurtureAt" DATETIME,
    "offerSentAt" DATETIME,
    "unsubscribedAt" DATETIME,
    "audience" TEXT,
    "offerNudgedAt" DATETIME,
    "offerClickedAt" DATETIME,
    "offerVariant" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Lead" ("acqRef", "audience", "buyIntentAt", "convertedToUserId", "createdAt", "email", "entrySource", "followupStage", "funnelSegment", "id", "lastBotMessageAt", "lastNurtureAt", "lastOrderNumber", "message", "name", "notes", "nurtureStage", "offerClickedAt", "offerNudgedAt", "offerSentAt", "offerVariant", "phone", "qualifiedAt", "qualifyReason", "respondedAt", "source", "status", "telegramChatIdBig", "telegramUsername", "unsubscribedAt", "updatedAt") SELECT "acqRef", "audience", "buyIntentAt", "convertedToUserId", "createdAt", "email", "entrySource", "followupStage", "funnelSegment", "id", "lastBotMessageAt", "lastNurtureAt", "lastOrderNumber", "message", "name", "notes", "nurtureStage", "offerClickedAt", "offerNudgedAt", "offerSentAt", "offerVariant", "phone", "qualifiedAt", "qualifyReason", "respondedAt", "source", "status", "telegramChatIdBig", "telegramUsername", "unsubscribedAt", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "Lead_telegramChatIdBig_idx" ON "Lead"("telegramChatIdBig");
CREATE INDEX "Lead_followupStage_idx" ON "Lead"("followupStage");
CREATE INDEX "Lead_nurtureStage_idx" ON "Lead"("nurtureStage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

