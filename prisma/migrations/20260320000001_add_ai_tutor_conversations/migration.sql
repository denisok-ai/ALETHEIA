-- CreateTable
CREATE TABLE "AiTutorConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiTutorConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiTutorConversation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiTutorMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiTutorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiTutorConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiTutorConversation_courseId_idx" ON "AiTutorConversation"("courseId");

-- CreateIndex
CREATE INDEX "AiTutorConversation_userId_idx" ON "AiTutorConversation"("userId");

-- CreateIndex
CREATE INDEX "AiTutorMessage_conversationId_idx" ON "AiTutorMessage"("conversationId");
