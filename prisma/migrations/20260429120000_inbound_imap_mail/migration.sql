-- CreateTable
CREATE TABLE "InboundMailbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL,
    "imapPort" INTEGER NOT NULL DEFAULT 993,
    "imapTls" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "lastUid" INTEGER,
    "lastSyncedAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpTls" BOOLEAN DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mailboxId" TEXT NOT NULL,
    "imapUid" INTEGER NOT NULL,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT NOT NULL DEFAULT '[]',
    "subject" TEXT,
    "receivedAt" DATETIME NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "matchedUserId" TEXT,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "snippet" TEXT,
    CONSTRAINT "InboundMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "InboundMailbox" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboundMessage_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_mailboxId_imapUid_key" ON "InboundMessage"("mailboxId", "imapUid");

-- CreateIndex
CREATE INDEX "InboundMessage_receivedAt_idx" ON "InboundMessage"("receivedAt");

-- CreateIndex
CREATE INDEX "InboundMessage_fromAddress_idx" ON "InboundMessage"("fromAddress");

-- CreateIndex
CREATE INDEX "InboundMessage_matchedUserId_idx" ON "InboundMessage"("matchedUserId");

-- CreateIndex
CREATE INDEX "InboundMessage_mailboxId_receivedAt_idx" ON "InboundMessage"("mailboxId", "receivedAt");
