-- PayKeeper: расширение Order + журналы возвратов и чеков
ALTER TABLE "Order" ADD COLUMN "paykeeperInvoiceId" TEXT;
ALTER TABLE "Order" ADD COLUMN "paykeeperInvoiceUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN "paykeeperPaymentId" TEXT;
ALTER TABLE "Order" ADD COLUMN "paykeeperStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "paykeeperRawStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "paidAmountRub" INTEGER;
ALTER TABLE "Order" ADD COLUMN "refundedAmountRub" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "receiptKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "lastSyncedAt" DATETIME;

CREATE INDEX "Order_paykeeperPaymentId_idx" ON "Order"("paykeeperPaymentId");
CREATE INDEX "Order_paykeeperInvoiceId_idx" ON "Order"("paykeeperInvoiceId");

CREATE TABLE "PaykeeperRefundRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "paykeeperPaymentId" TEXT NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "partial" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "resultMsg" TEXT,
    "rawResponse" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaykeeperRefundRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PaykeeperRefundRecord_orderId_idx" ON "PaykeeperRefundRecord"("orderId");
CREATE INDEX "PaykeeperRefundRecord_paykeeperPaymentId_idx" ON "PaykeeperRefundRecord"("paykeeperPaymentId");

CREATE TABLE "PaykeeperReceiptRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'api',
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaykeeperReceiptRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PaykeeperReceiptRecord_orderId_idx" ON "PaykeeperReceiptRecord"("orderId");
CREATE INDEX "PaykeeperReceiptRecord_paymentId_idx" ON "PaykeeperReceiptRecord"("paymentId");
