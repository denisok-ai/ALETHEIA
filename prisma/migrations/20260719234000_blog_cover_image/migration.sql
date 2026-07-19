-- Иллюстрация статьи, отдельная от картинки для соцсетей: последняя обычно
-- является карточкой 1200×630 с текстом поверх и в теле статьи выглядит чужеродно.
ALTER TABLE "BlogPost" ADD COLUMN "coverImage" TEXT;

-- У постов, перенесённых из Telegram, картинка — настоящее фото: годится и как
-- превью, и как иллюстрация.
UPDATE "BlogPost" SET "coverImage" = "ogImage" WHERE source = 'telegram' AND "ogImage" IS NOT NULL;
