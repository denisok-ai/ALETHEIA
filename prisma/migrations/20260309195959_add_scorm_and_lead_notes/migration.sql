-- AlterTable
ALTER TABLE "Course" ADD COLUMN "aiContext" TEXT;
ALTER TABLE "Course" ADD COLUMN "scormManifest" TEXT;
ALTER TABLE "Course" ADD COLUMN "scormVersion" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "notes" TEXT;
