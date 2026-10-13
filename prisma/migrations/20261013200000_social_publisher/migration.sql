-- Автопубликация в соцсети (T3.4–T3.5, docs/Plan-SEO-Social-2026-10.md).
--
-- Только ADD COLUMN: существующие таблицы не пересоздаются, данные не трогаются.
--   SocialNetwork.chatId      — id чата/канала для публикации (telegram: -100…);
--   SocialNetwork.failStreak  — подряд неудачных попыток; две подряд — сеть выключается;
--   SocialNetwork.lastError   — текст последней ошибки сети;
--   SocialPost.externalUrl    — публичная ссылка на опубликованный пост.

-- AlterTable
ALTER TABLE "SocialNetwork" ADD COLUMN "chatId" TEXT;
ALTER TABLE "SocialNetwork" ADD COLUMN "failStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialNetwork" ADD COLUMN "lastError" TEXT;

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN "externalUrl" TEXT;
