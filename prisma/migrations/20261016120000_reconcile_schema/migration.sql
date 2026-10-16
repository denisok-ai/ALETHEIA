-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BrandProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL DEFAULT 'avaterra',
    "kbVersion" TEXT,
    "dataJson" TEXT NOT NULL,
    "toneOfVoice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BrandProfile" ("createdAt", "dataJson", "id", "kbVersion", "slug", "toneOfVoice", "updatedAt") SELECT "createdAt", "dataJson", "id", "kbVersion", "slug", "toneOfVoice", "updatedAt" FROM "BrandProfile";
DROP TABLE "BrandProfile";
ALTER TABLE "new_BrandProfile" RENAME TO "BrandProfile";
CREATE UNIQUE INDEX "BrandProfile_slug_key" ON "BrandProfile"("slug");
CREATE TABLE "new_DomainMailbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "localPart" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'avaterra.pro',
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "passwordEnc" TEXT NOT NULL,
    "provisioningKind" TEXT NOT NULL DEFAULT 'mailcow',
    "provisioningRef" TEXT,
    "inboundMailboxId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DomainMailbox_inboundMailboxId_fkey" FOREIGN KEY ("inboundMailboxId") REFERENCES "InboundMailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DomainMailbox" ("createdAt", "createdById", "domain", "email", "id", "inboundMailboxId", "label", "localPart", "passwordEnc", "provisioningKind", "provisioningRef", "status", "updatedAt") SELECT "createdAt", "createdById", "domain", "email", "id", "inboundMailboxId", "label", "localPart", "passwordEnc", "provisioningKind", "provisioningRef", "status", "updatedAt" FROM "DomainMailbox";
DROP TABLE "DomainMailbox";
ALTER TABLE "new_DomainMailbox" RENAME TO "DomainMailbox";
CREATE UNIQUE INDEX "DomainMailbox_email_key" ON "DomainMailbox"("email");
CREATE UNIQUE INDEX "DomainMailbox_inboundMailboxId_key" ON "DomainMailbox"("inboundMailboxId");
CREATE INDEX "DomainMailbox_domain_idx" ON "DomainMailbox"("domain");
CREATE INDEX "DomainMailbox_localPart_domain_idx" ON "DomainMailbox"("localPart", "domain");
CREATE TABLE "new_LlmSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT,
    "temperature" REAL DEFAULT 0.7,
    "maxTokens" INTEGER DEFAULT 2000,
    "apiKeyEncrypted" TEXT,
    "apiKeyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LlmSetting_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "LlmApiKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LlmSetting" ("apiKeyEncrypted", "apiKeyId", "createdAt", "id", "key", "maxTokens", "model", "provider", "systemPrompt", "temperature", "updatedAt") SELECT "apiKeyEncrypted", "apiKeyId", "createdAt", "id", "key", "maxTokens", "model", "provider", "systemPrompt", "temperature", "updatedAt" FROM "LlmSetting";
DROP TABLE "LlmSetting";
ALTER TABLE "new_LlmSetting" RENAME TO "LlmSetting";
CREATE UNIQUE INDEX "LlmSetting_key_key" ON "LlmSetting"("key");
CREATE INDEX "LlmSetting_apiKeyId_idx" ON "LlmSetting"("apiKeyId");
CREATE TABLE "new_PaykeeperRefundRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "paykeeperPaymentId" TEXT NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "resultMsg" TEXT,
    "rawResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaykeeperRefundRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PaykeeperRefundRecord" ("amountRub", "createdAt", "id", "orderId", "partial", "paykeeperPaymentId", "rawResponse", "resultMsg", "status") SELECT "amountRub", "createdAt", "id", "orderId", "partial", "paykeeperPaymentId", "rawResponse", "resultMsg", "status" FROM "PaykeeperRefundRecord";
DROP TABLE "PaykeeperRefundRecord";
ALTER TABLE "new_PaykeeperRefundRecord" RENAME TO "PaykeeperRefundRecord";
CREATE INDEX "PaykeeperRefundRecord_orderId_idx" ON "PaykeeperRefundRecord"("orderId");
CREATE INDEX "PaykeeperRefundRecord_paykeeperPaymentId_idx" ON "PaykeeperRefundRecord"("paykeeperPaymentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

