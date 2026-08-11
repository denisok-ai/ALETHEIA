# AVATERRA / ALETHEIA — путеводитель для Claude

Phygital-школа кинезиологии «Аватэрра» (avaterra.pro): Next.js 14 (App Router) + Prisma/SQLite, лендинг + блог + портал (студент/менеджер/админ) + SCORM-плеер + платежи PayKeeper + почта Mailcow. Владелец: Denis Sosin; бренд-мастер: Татьяна Стрельцова.

## Прежде чем писать код

- **История решений — в [docs/Diary.md](docs/Diary.md)** (новые записи сверху). CHANGELOG.md — раздел [Unreleased]. После любой значимой работы дополняй оба.
- **Бэклог:** [docs/Tasktracker.md](docs/Tasktracker.md), [docs/Backlog-Optional.md](docs/Backlog-Optional.md). Перед реализацией пункта бэклога проверь код — пункты бывают уже реализованы.
- Контент-правила школы (запрещённые фразы, дисклеймеры, «мы не лечим») — `content/knowledge/avaterra.yaml`. SEO-статьи блога — `lib/content/kb-seo-articles.ts` (публикация: `scripts/blog-publish-kb-articles.ts` на сервере).

## Деплой и прод

- **Прод:** VPS 95.181.224.70, каталог `/opt/ALETHEIA`, systemd `aletheia`, БД SQLite `prisma/dev.db` (НЕ трогать деплоем).
- **Из облачной сессии (телефон, claude.ai/code): SSH к серверу НЕТ.** Путь в прод один — commit + push в `main`: GitHub Actions (`.github/workflows/deploy.yml`) соберёт и задеплоит (`scripts/deploy-pull.sh` на сервере). Не мержи в main непроверенный код: `npm run build` и `npx tsc --noEmit` обязательны перед push.
- **С машины владельца (WSL):** `npm run deploy:rsync` (локальная сборка + rsync; серверные `.env` и БД не трогает).
- Проверки после деплоя (работают откуда угодно, без SSH):
  - `npx tsx scripts/prod-verify.ts` — 16 проверок прода, эталон «Всё в порядке»;
  - `npx tsx scripts/seo-audit-live.ts https://avaterra.pro` — эталон 0 ошибок;
  - `npx tsx scripts/llm-guard-check.ts` — защита от prompt injection.

## Грабли (повторяются — проверяй)

- Title страниц: бренд добавляет шаблон layout (`%s | АВАТЕРРА`) — вручную не дописывать (двойной суффикс).
- IP клиента — только через `lib/client-ip.ts` (первый элемент XFF подделывается).
- Prisma 5.22: `tariffId: { not: null }` падает в рантайме — фильтровать null в коде.
- Правишь статическую страницу — обнови дату в `CONTENT_REVISED` (`app/sitemap.ts`).
- `Order.userId` проставляется ТОЛЬКО вместе с созданием Enrollment — на этом держится сверка платежей, не ломать.
- robots.txt закрывает `/api/`, но OG-карточки `/api/og/` явно разрешены — не потеряй `ALLOW_EXCEPTIONS` при правках.
- Установщик крона `scripts/install-aletheia-http-cron.sh` перезаписывает `/etc/cron.d/aletheia-http-cron` целиком: новые записи добавлять В УСТАНОВЩИК.
- В тексте школа — «Аватэрра» кириллицей; цены в статьях не называть; «калибровка» — запрещённое слово (говорить «сверка баланса»).

## Стиль

- Коммиты: `type(scope): описание` на русском, с содержательным телом.
- Язык общения с владельцем — русский.
