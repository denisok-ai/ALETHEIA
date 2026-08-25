-- Диалог лида в Telegram и автодогоны.
-- Только ADD COLUMN: пересоздавать таблицу на боевой базе нельзя.
ALTER TABLE "Lead" ADD COLUMN "telegramChatId" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "telegramUsername" TEXT;
ALTER TABLE "Lead" ADD COLUMN "funnelSegment" TEXT;
ALTER TABLE "Lead" ADD COLUMN "entrySource" TEXT;
ALTER TABLE "Lead" ADD COLUMN "followupStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "lastBotMessageAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "respondedAt" DATETIME;

CREATE INDEX "Lead_telegramChatId_idx" ON "Lead"("telegramChatId");
CREATE INDEX "Lead_followupStage_idx" ON "Lead"("followupStage");
