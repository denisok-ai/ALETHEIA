-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "context" TEXT,
    "userId" TEXT,
    "emailNorm" TEXT,
    "orderNumber" TEXT,
    "docVersion" TEXT NOT NULL DEFAULT '2026-04-30',
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ConsentLog_createdAt_idx" ON "ConsentLog"("createdAt");

-- CreateIndex
CREATE INDEX "ConsentLog_emailNorm_idx" ON "ConsentLog"("emailNorm");
