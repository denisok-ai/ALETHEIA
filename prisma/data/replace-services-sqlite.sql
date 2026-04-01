-- Замена всех строк витрины (Service) на три актуальных тарифа.
-- SQLite (Prisma file:./… в DATABASE_URL).
--
-- Узнать путь к файлу БД:
--   bash scripts/check-database-url.sh
--
-- Запуск (подставьте путь к .db из вывода скрипта или из .env):
--   sqlite3 /opt/ALETHEIA/prisma/dev.db -bail < prisma/data/replace-services-sqlite.sql
--
-- Если DATABASE_URL=file:./prod.db — файл обычно в prisma/prod.db относительно cwd приложения.

BEGIN TRANSACTION;

DELETE FROM "Service";

INSERT INTO "Service" (
  "id",
  "slug",
  "name",
  "description",
  "imageUrl",
  "price",
  "paykeeperTariffId",
  "courseId",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  'cmshopreplace01kodtela00',
  'kod-tela-start',
  'Код тела: введение в мышечное тестирование',
  'Бесплатный мини-курс: первые шаги в мышечное тестирование без «сложно и не для меня».
• 3–4 динамичных видео (7–15 минут каждое)
• Видео 1 — что такое кинезиология и как тело реагирует на стресс и скрытые эмоции
• Видео 2 — наглядный пример теста из реальной практики
• Видео 3 — простое упражнение: само-тест «Да/Нет» на вашем теле
• Видео 4 — про полный путь в школе и ограниченное предложение на «Профи» и «ВИП»',
  NULL,
  0,
  'kod-tela-start',
  (SELECT COALESCE(
    (SELECT "id" FROM "Course" WHERE "status" = 'published' ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1),
    (SELECT "id" FROM "Course" ORDER BY "createdAt" ASC LIMIT 1)
  )),
  1,
  datetime('now'),
  datetime('now')
);

INSERT INTO "Service" (
  "id",
  "slug",
  "name",
  "description",
  "imageUrl",
  "price",
  "paykeeperTariffId",
  "courseId",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  'cmshopreplace02praktik0',
  'avaterra-praktik',
  'AVATERRA: Практик',
  'Тариф «Профи»: фундаментальный навык мышечного тестирования для себя, близких или старта с клиентами.
• Полный дистанционный курс: введение, основы тестирования, подсознание, практика и интеграция
• Дополнительные видео: библиотека эмоций, типичные ошибки новичков, скрипты и алгоритмы
• Регулярные Zoom с сертифицированными кураторами-практиками школы
• Формат Q&A, отработка техники под наблюдением эксперта, разбор ваших ситуаций',
  NULL,
  25000,
  'avaterra-praktik',
  (SELECT COALESCE(
    (SELECT "id" FROM "Course" WHERE "status" = 'published' ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1),
    (SELECT "id" FROM "Course" ORDER BY "createdAt" ASC LIMIT 1)
  )),
  1,
  datetime('now'),
  datetime('now')
);

INSERT INTO "Service" (
  "id",
  "slug",
  "name",
  "description",
  "imageUrl",
  "price",
  "paykeeperTariffId",
  "courseId",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  'cmshopreplace03mastervip',
  'avaterra-master-vip',
  'AVATERRA: Мастер. Менторство Татьяны Стрельцовой',
  'Тариф «ВИП»: глубокое погружение и личное время основателя с многолетним опытом.
• Всё из тарифа «Профи»: полный курс и базовые дополнительные материалы
• Закрытые онлайн-встречи с Татьяной Стрельцовой для узкой группы VIP-учеников
• Супервизия, разбор на глубоком уровне, коррекция техники от автора методики
• Секретный модуль: продвинутые техники, сложная психосоматика, интеграция биохакинга, монетизация навыка',
  NULL,
  69000,
  'avaterra-master-vip',
  (SELECT COALESCE(
    (SELECT "id" FROM "Course" WHERE "status" = 'published' ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1),
    (SELECT "id" FROM "Course" ORDER BY "createdAt" ASC LIMIT 1)
  )),
  1,
  datetime('now'),
  datetime('now')
);

COMMIT;
