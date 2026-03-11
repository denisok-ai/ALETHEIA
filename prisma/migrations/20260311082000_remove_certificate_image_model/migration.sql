-- DropTable
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Recreate CertificateTemplate without imageId
CREATE TABLE "new_CertificateTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "backgroundImageUrl" TEXT,
    "textMapping" TEXT,
    "courseId" TEXT,
    "minScore" INTEGER,
    "requiredStatus" TEXT,
    "validityDays" INTEGER,
    "numberingFormat" TEXT,
    "allowUserDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CertificateTemplate" ("id", "name", "backgroundImageUrl", "textMapping", "courseId", "minScore", "requiredStatus", "validityDays", "numberingFormat", "allowUserDownload", "createdAt", "updatedAt")
SELECT "id", "name", "backgroundImageUrl", "textMapping", "courseId", "minScore", "requiredStatus", "validityDays", "numberingFormat", "allowUserDownload", "createdAt", "updatedAt" FROM "CertificateTemplate";
DROP TABLE "CertificateTemplate";
ALTER TABLE "new_CertificateTemplate" RENAME TO "CertificateTemplate";

DROP TABLE "CertificateImage";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
