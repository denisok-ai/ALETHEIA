-- CreateTable
CREATE TABLE "DomainMailbox" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainMailbox_email_key" ON "DomainMailbox"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DomainMailbox_inboundMailboxId_key" ON "DomainMailbox"("inboundMailboxId");

-- CreateIndex
CREATE INDEX "DomainMailbox_domain_idx" ON "DomainMailbox"("domain");

-- CreateIndex
CREATE INDEX "DomainMailbox_localPart_domain_idx" ON "DomainMailbox"("localPart", "domain");
