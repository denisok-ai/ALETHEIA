-- CreateTable
CREATE TABLE "PersonalProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceRub" INTEGER NOT NULL,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "clientEmail" TEXT,
    "clientName" TEXT,
    "userId" TEXT,
    "orderId" INTEGER,
    "paykeeperInvoiceId" TEXT,
    "paykeeperInvoiceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "PaymentLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PersonalProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "totalParts" INTEGER NOT NULL,
    "partAmountRub" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "nextPaymentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstallmentPlan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstallmentPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledAt" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "paykeeperPaymentId" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstallmentPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstallmentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentLink_token_key" ON "PaymentLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlan_orderId_key" ON "InstallmentPlan"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPayment_planId_partNumber_key" ON "InstallmentPayment"("planId", "partNumber");

-- CreateIndex
CREATE INDEX "PersonalProduct_isActive_idx" ON "PersonalProduct"("isActive");

-- CreateIndex
CREATE INDEX "PersonalProduct_createdAt_idx" ON "PersonalProduct"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentLink_token_idx" ON "PaymentLink"("token");

-- CreateIndex
CREATE INDEX "PaymentLink_status_idx" ON "PaymentLink"("status");

-- CreateIndex
CREATE INDEX "PaymentLink_productId_idx" ON "PaymentLink"("productId");

-- CreateIndex
CREATE INDEX "PaymentLink_paykeeperInvoiceId_idx" ON "PaymentLink"("paykeeperInvoiceId");

-- CreateIndex
CREATE INDEX "PaymentLink_createdAt_idx" ON "PaymentLink"("createdAt");

-- CreateIndex
CREATE INDEX "InstallmentPlan_status_idx" ON "InstallmentPlan"("status");

-- CreateIndex
CREATE INDEX "InstallmentPlan_nextPaymentAt_idx" ON "InstallmentPlan"("nextPaymentAt");

-- CreateIndex
CREATE INDEX "InstallmentPayment_status_idx" ON "InstallmentPayment"("status");

-- CreateIndex
CREATE INDEX "InstallmentPayment_scheduledAt_idx" ON "InstallmentPayment"("scheduledAt");
