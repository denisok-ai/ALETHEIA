-- AlterTable
ALTER TABLE "CommsSend" ADD COLUMN "errorMessage" TEXT;
ALTER TABLE "CommsSend" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
