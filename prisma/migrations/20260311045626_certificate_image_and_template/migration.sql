-- CreateTable
CREATE TABLE "CertificateImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "backgroundImageUrl" TEXT NOT NULL,
    "textMapping" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageId" TEXT,
    "courseId" TEXT,
    "minScore" INTEGER,
    "requiredStatus" TEXT,
    "validityDays" INTEGER,
    "numberingFormat" TEXT,
    "allowUserDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CertificateTemplate_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "CertificateImage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CertificateTemplate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "templateId" TEXT,
    "certNumber" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "expiryDate" DATETIME,
    CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Certificate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CertificateTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Certificate" ("certNumber", "courseId", "expiryDate", "id", "issuedAt", "pdfUrl", "revokedAt", "userId") SELECT "certNumber", "courseId", "expiryDate", "id", "issuedAt", "pdfUrl", "revokedAt", "userId" FROM "Certificate";
DROP TABLE "Certificate";
ALTER TABLE "new_Certificate" RENAME TO "Certificate";
CREATE UNIQUE INDEX "Certificate_certNumber_key" ON "Certificate"("certNumber");
CREATE UNIQUE INDEX "Certificate_userId_courseId_key" ON "Certificate"("userId", "courseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
