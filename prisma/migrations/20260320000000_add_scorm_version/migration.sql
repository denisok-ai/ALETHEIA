-- CreateTable
CREATE TABLE "ScormVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scormPath" TEXT NOT NULL,
    "scormVersion" TEXT,
    "scormManifest" TEXT,
    "aiContext" TEXT,
    "fileSize" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScormVersion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScormVersion_courseId_version_key" ON "ScormVersion"("courseId", "version");

-- CreateIndex
CREATE INDEX "ScormVersion_courseId_idx" ON "ScormVersion"("courseId");
