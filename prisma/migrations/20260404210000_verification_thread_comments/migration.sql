-- CreateTable
CREATE TABLE "PhygitalVerificationThreadComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "verificationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhygitalVerificationThreadComment_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "PhygitalVerification" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhygitalVerificationThreadComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PhygitalVerificationThreadComment_verificationId_createdAt_idx" ON "PhygitalVerificationThreadComment"("verificationId", "createdAt");
