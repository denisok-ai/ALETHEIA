-- Замена всех строк витрины (Service) на три актуальных тарифа.
-- PostgreSQL только. Если на сервере SQLite (DATABASE_URL=file:...) — см. replace-services-sqlite.sql
-- Проверка: bash scripts/check-database-url.sh
--
-- courseId = первый опубликованный курс, иначе первый курс в БД.
--
-- На сервере:
--   cd /opt/ALETHEIA
--   set -a && . ./.env && set +a
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/data/replace-services-pg.sql

BEGIN;

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
)
VALUES (
  'cmshopreplace01kodtela00',
  'kod-tela-start',
  'Код тела: введение в мышечное тестирование',
  $d1$Бесплатный мини-курс: первые шаги в мышечное тестирование без «сложно и не для меня».
• 3–4 динамичных видео (7–15 минут каждое)
• Видео 1 — что такое кинезиология и как тело реагирует на стресс и скрытые эмоции
• Видео 2 — наглядный пример теста из реальной практики
• Видео 3 — простое упражнение: само-тест «Да/Нет» на вашем теле
• Видео 4 — про полный путь в школе и ограниченное предложение на «Профи» и «ВИП»$d1$,
  NULL,
  0,
  'kod-tela-start',
  (SELECT COALESCE(
    (SELECT "id" FROM "Course" WHERE "status" = 'published' ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1),
    (SELECT "id" FROM "Course" ORDER BY "createdAt" ASC LIMIT 1)
  )),
  true,
  NOW(),
  NOW()
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
)
VALUES (
  'cmshopreplace02praktik0',
  'avaterra-praktik',
  'AVATERRA: Практик',
  $d2$Тариф «Профи»: фундаментальный навык мышечного тестирования для себя, близких или старта с клиентами.
• Полный дистанционный курс: введение, основы тестирования, подсознание, практика и интеграция
• Дополнительные видео: библиотека эмоций, типичные ошибки новичков, скрипты и алгоритмы
• Регулярные Zoom с сертифицированными кураторами-практиками школы
• Формат Q&A, отработка техники под наблюдением эксперта, разбор ваших ситуаций$d2$,
  NULL,
  25000,
  'avaterra-praktik',
  (SELECT COALESCE(
    (SELECT "id" FROM "Course" WHERE "status" = 'published' ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1),
    (SELECT "id" FROM "Course" ORDER BY "createdAt" ASC LIMIT 1)
  )),
  true,
  NOW(),
  NOW()
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
)
VALUES (
  'cmshopreplace03mastervip',
  'avaterra-master-vip',
  'AVATERRA: Мастер. Менторство Татьяны Стрельцовой',
  $d3$Тариф «ВИП»: глубокое погружение и личное время основателя с многолетним опытом.
• Всё из тарифа «Профи»: полный курс и базовые дополнительные материалы
• Закрытые онлайн-встречи с Татьяной Стрельцовой для узкой группы VIP-учеников
• Супервизия, разбор на глубоком уровне, коррекция техники от автора методики
• Секретный модуль: продвинутые техники, сложная психосоматика, интеграция биохакинга, монетизация навыка$d3$,
  NULL,
  69000,
  'avaterra-master-vip',
  (SELECT COALESCE(
    (SELECT "id" FROM "Course" WHERE "status" = 'published' ORDER BY "sortOrder" ASC, "createdAt" ASC LIMIT 1),
    (SELECT "id" FROM "Course" ORDER BY "createdAt" ASC LIMIT 1)
  )),
  true,
  NOW(),
  NOW()
);

COMMIT;
