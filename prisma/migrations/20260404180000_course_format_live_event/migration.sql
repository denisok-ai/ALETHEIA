-- AlterTable
ALTER TABLE "Course" ADD COLUMN "courseFormat" TEXT NOT NULL DEFAULT 'scorm';
ALTER TABLE "Course" ADD COLUMN "eventVenue" TEXT;
ALTER TABLE "Course" ADD COLUMN "eventUrl" TEXT;
