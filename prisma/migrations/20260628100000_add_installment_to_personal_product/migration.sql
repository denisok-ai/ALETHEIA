-- AlterTable
ALTER TABLE "PersonalProduct" ADD COLUMN "installmentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PersonalProduct" ADD COLUMN "maxInstallments" INTEGER NOT NULL DEFAULT 3;
