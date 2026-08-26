-- Автономная воронка: квалификация, интент покупки, прогрев, оффер, отписка.
-- Только ADD COLUMN: пересоздание таблицы на боевой базе недопустимо.
ALTER TABLE "Lead" ADD COLUMN "qualifiedAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "qualifyReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN "buyIntentAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "nurtureStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "lastNurtureAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "offerSentAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "unsubscribedAt" DATETIME;
CREATE INDEX "Lead_nurtureStage_idx" ON "Lead"("nurtureStage");
