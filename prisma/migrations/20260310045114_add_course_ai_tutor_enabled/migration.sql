-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scormPath" TEXT,
    "scormVersion" TEXT,
    "scormManifest" TEXT,
    "aiContext" TEXT,
    "aiTutorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "thumbnailUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "price" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Course" ("aiContext", "createdAt", "description", "id", "price", "scormManifest", "scormPath", "scormVersion", "sortOrder", "status", "thumbnailUrl", "title", "updatedAt") SELECT "aiContext", "createdAt", "description", "id", "price", "scormManifest", "scormPath", "scormVersion", "sortOrder", "status", "thumbnailUrl", "title", "updatedAt" FROM "Course";
DROP TABLE "Course";
ALTER TABLE "new_Course" RENAME TO "Course";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
