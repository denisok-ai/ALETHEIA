-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "loginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutAt" DATETIME,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "VisitLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VisitLog_userId_idx" ON "VisitLog"("userId");

-- CreateIndex
CREATE INDEX "VisitLog_loginAt_idx" ON "VisitLog"("loginAt");

-- CreateIndex
CREATE INDEX "VisitLog_lastActivityAt_idx" ON "VisitLog"("lastActivityAt");
