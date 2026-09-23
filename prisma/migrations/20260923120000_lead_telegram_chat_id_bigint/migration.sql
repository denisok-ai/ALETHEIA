-- Lead.telegramChatId → BIGINT.
--
-- ID чатов Telegram давно вышли за 2^31 (в базе уже 6052587367, 6625906858).
-- SQLite хранил их без потерь, но Prisma выбирает разрядность по объявленному
-- типу колонки: INTEGER читается как int32, и любой запрос, вернувший такую
-- строку, падал (P2023 «does not fit in an INT column») — список CRM, сводка
-- воронки, догоны, создание лида из бота.
--
-- Сменить тип колонки в SQLite можно только пересозданием таблицы, а это
-- запрещено правилами проекта (только ADD COLUMN). Поэтому: новая колонка
-- BIGINT, копия данных, поле схемы переводится на неё через @map. Старая
-- колонка telegramChatId остаётся в таблице неиспользуемой (её индекс удаляем,
-- чтобы не держать мёртвый индекс).
ALTER TABLE "Lead" ADD COLUMN "telegramChatIdBig" BIGINT;
UPDATE "Lead" SET "telegramChatIdBig" = "telegramChatId" WHERE "telegramChatId" IS NOT NULL;
DROP INDEX IF EXISTS "Lead_telegramChatId_idx";
CREATE INDEX "Lead_telegramChatIdBig_idx" ON "Lead"("telegramChatIdBig");
