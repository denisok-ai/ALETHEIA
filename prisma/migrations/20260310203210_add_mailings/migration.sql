-- CreateTable
CREATE TABLE "Mailing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalTitle" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "scheduleMode" TEXT NOT NULL DEFAULT 'manual',
    "scheduledAt" DATETIME,
    "recipientConfig" TEXT,
    "attachments" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Mailing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MailingLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mailingId" TEXT NOT NULL,
    "userId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MailingLog_mailingId_fkey" FOREIGN KEY ("mailingId") REFERENCES "Mailing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MailingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MailingLog_mailingId_idx" ON "MailingLog"("mailingId");
