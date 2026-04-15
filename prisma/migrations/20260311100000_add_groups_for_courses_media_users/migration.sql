-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "moduleType" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'static',
    "accessType" TEXT NOT NULL DEFAULT 'common',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "smallIcon" TEXT,
    "largeIcon" TEXT,
    "showSubgroupsMode" TEXT,
    "sourceCourseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourseGroup" (
    "courseId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "CourseGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("courseId", "groupId")
);

-- CreateTable
CREATE TABLE "MediaGroup" (
    "mediaId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "MediaGroup_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("mediaId", "groupId")
);

-- CreateTable
CREATE TABLE "UserGroup" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY ("userId", "groupId")
);

-- CreateIndex
CREATE INDEX "Group_parentId_idx" ON "Group"("parentId");
CREATE INDEX "Group_moduleType_idx" ON "Group"("moduleType");
CREATE INDEX "CourseGroup_groupId_idx" ON "CourseGroup"("groupId");
CREATE INDEX "MediaGroup_groupId_idx" ON "MediaGroup"("groupId");
CREATE INDEX "UserGroup_groupId_idx" ON "UserGroup"("groupId");
