-- CreateTable
CREATE TABLE "LlmApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AlterTable: add apiKeyId to LlmSetting (SQLite: no FK in ALTER)
ALTER TABLE "LlmSetting" ADD COLUMN "apiKeyId" TEXT;

-- CreateIndex
CREATE INDEX "LlmSetting_apiKeyId_idx" ON "LlmSetting"("apiKeyId");
