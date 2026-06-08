-- Add IMAP diagnostics fields.
ALTER TABLE "InboundMailbox" ADD COLUMN "lastSyncStatus" TEXT;
ALTER TABLE "InboundMailbox" ADD COLUMN "lastSyncError" TEXT;
ALTER TABLE "InboundMailbox" ADD COLUMN "lastSyncCheckedAt" DATETIME;
ALTER TABLE "InboundMailbox" ADD COLUMN "retentionDays" INTEGER NOT NULL DEFAULT 365;

-- CreateTable: common outbound email delivery log without message body.
CREATE TABLE "EmailDeliveryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "errorMessage" TEXT,
    "sentBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailDeliveryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EmailDeliveryLog_module_idx" ON "EmailDeliveryLog"("module");
CREATE INDEX "EmailDeliveryLog_entityId_idx" ON "EmailDeliveryLog"("entityId");
CREATE INDEX "EmailDeliveryLog_userId_idx" ON "EmailDeliveryLog"("userId");
CREATE INDEX "EmailDeliveryLog_recipient_idx" ON "EmailDeliveryLog"("recipient");
CREATE INDEX "EmailDeliveryLog_createdAt_idx" ON "EmailDeliveryLog"("createdAt");
