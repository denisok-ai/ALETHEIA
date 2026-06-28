-- AlterTable
ALTER TABLE "Service" ADD COLUMN "installmentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN "maxInstallments" INTEGER NOT NULL DEFAULT 3;
