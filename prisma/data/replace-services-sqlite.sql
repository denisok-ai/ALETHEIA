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
  'Тело знает всё: введение в мышечное тестирование',
  'Бесплатный мини-курс для знакомства с методом: снять страх «не получится», дать быстрый «вау»-эффект и мягко подвести к платным тарифам.
• 3–4 коротких видео по 7–15 минут
• Видео 1 — знакомство: кинезиология, стресс, скрытые эмоции
• Видео 2 — демонстрация теста из практики
• Видео 3 — практика: простой само-тест «Да/Нет» на вашем теле
• Видео 4 — полный путь в школе и предложение тарифов «Практик» и VIP',
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
  '«Аватера»: Практик',
  'Тариф «Практик»: фундаментальный навык мышечного тестирования — на себе, для близких или старта работы с клиентами.
• Полный дистанционный курс: введение, основы тестирования, подсознание, методы работы с подсознанием
• Доп. видео: библиотека эмоций, ошибки новичков, скрипты и алгоритмы
• Регулярные Zoom с сертифицированными кураторами школы
• Вопросы и ответы, отработка техники под наблюдением эксперта, разбор ваших ситуаций',
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
  '«Аватера»: Мастер. Наставничество Татьяны Стрельцовой',
  'Тариф VIP: глубокое погружение, авторские нюансы и личное время основателя с 22-летним опытом.
• Всё из тарифа «Практик»: курс и базовые дополнительные материалы
• Закрытые онлайн-встречи с Татьяной Стрельцовой для узкой группы
• Обучение диагностике и применение в авторских техниках
• Закрытый модуль: продвинутые техники, сложные кейсы, интеграция системы в жизнь',
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
