-- AlterTable
ALTER TABLE "InstallmentPayment" ADD COLUMN "reminderSent3d" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InstallmentPayment" ADD COLUMN "reminderSent1d" BOOLEAN NOT NULL DEFAULT false;
