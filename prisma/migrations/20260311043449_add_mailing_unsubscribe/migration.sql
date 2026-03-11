-- CreateTable
CREATE TABLE "MailingUnsubscribe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "MailingUnsubscribe_email_key" ON "MailingUnsubscribe"("email");
