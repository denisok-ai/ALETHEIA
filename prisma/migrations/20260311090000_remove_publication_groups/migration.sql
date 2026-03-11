-- Remove PublicationGroup and groupId from Publication
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "publishAt" DATETIME NOT NULL,
    "teaser" TEXT,
    "content" TEXT NOT NULL,
    "keywords" TEXT,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowRating" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Publication" ("id", "title", "type", "status", "publishAt", "teaser", "content", "keywords", "viewsCount", "ratingSum", "ratingCount", "allowComments", "allowRating", "createdAt", "updatedAt")
SELECT "id", "title", "type", "status", "publishAt", "teaser", "content", "keywords", "viewsCount", "ratingSum", "ratingCount", "allowComments", "allowRating", "createdAt", "updatedAt" FROM "Publication";
DROP TABLE "Publication";
ALTER TABLE "new_Publication" RENAME TO "Publication";

DROP TABLE "PublicationGroup";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
