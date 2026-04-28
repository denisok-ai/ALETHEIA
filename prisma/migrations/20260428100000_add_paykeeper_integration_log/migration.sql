-- CreateTable
CREATE TABLE "PaykeeperIntegrationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orderNumber" TEXT,
    "invoiceUrl" TEXT,
    "httpStatus" INTEGER,
    "message" TEXT,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PaykeeperIntegrationLog_createdAt_idx" ON "PaykeeperIntegrationLog"("createdAt");

-- CreateIndex
CREATE INDEX "PaykeeperIntegrationLog_orderNumber_idx" ON "PaykeeperIntegrationLog"("orderNumber");

-- CreateIndex
CREATE INDEX "PaykeeperIntegrationLog_event_idx" ON "PaykeeperIntegrationLog"("event");

-- CreateIndex
CREATE INDEX "PaykeeperIntegrationLog_status_idx" ON "PaykeeperIntegrationLog"("status");
