-- AlterTable
ALTER TABLE "CertificateTemplate" ADD COLUMN "backgroundImageUrl" TEXT;
ALTER TABLE "CertificateTemplate" ADD COLUMN "textMapping" TEXT;

-- Copy data from CertificateImage to template (for later removal of imageId)
UPDATE "CertificateTemplate" SET
  "backgroundImageUrl" = (SELECT "backgroundImageUrl" FROM "CertificateImage" WHERE "CertificateImage"."id" = "CertificateTemplate"."imageId"),
  "textMapping" = (SELECT "textMapping" FROM "CertificateImage" WHERE "CertificateImage"."id" = "CertificateTemplate"."imageId")
WHERE "imageId" IS NOT NULL;
