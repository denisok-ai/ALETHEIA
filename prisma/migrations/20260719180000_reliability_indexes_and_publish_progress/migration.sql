-- Прогресс публикации поста: чтобы повтор после обрыва не слал подписчикам
-- начало поста второй раз.
ALTER TABLE "ContentItem" ADD COLUMN "publishedPhoto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ContentItem" ADD COLUMN "publishedChunks" INTEGER NOT NULL DEFAULT 0;

-- Очередь проверок менеджера: не было ни одного индекса.
CREATE INDEX "PhygitalVerification_status_createdAt_idx" ON "PhygitalVerification"("status", "createdAt");
CREATE INDEX "PhygitalVerification_courseId_idx" ON "PhygitalVerification"("courseId");
CREATE INDEX "PhygitalVerification_userId_idx" ON "PhygitalVerification"("userId");

-- Отчёты группируют по courseId; составной unique здесь не работает.
CREATE INDEX "ScormProgress_courseId_idx" ON "ScormProgress"("courseId");

-- Журнал отправок: фильтр по статусу и сортировка по дате.
CREATE INDEX "CommsSend_sentAt_idx" ON "CommsSend"("sentAt");
CREATE INDEX "CommsSend_status_sentAt_idx" ON "CommsSend"("status", "sentAt");

-- Составные там, где раздельные бесполезны (планировщик берёт только один).
CREATE INDEX "VisitLog_userId_logoutAt_idx" ON "VisitLog"("userId", "logoutAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Поиск заказов клиента по почте (сверка зачислений, привязка при входе).
CREATE INDEX "Order_clientEmail_idx" ON "Order"("clientEmail");

-- Один Telegram-аккаунт — один профиль. Проверено: дублей на проде нет.
CREATE UNIQUE INDEX "Profile_telegramId_key" ON "Profile"("telegramId");
