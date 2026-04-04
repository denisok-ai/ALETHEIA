# Конфигурация: БД и переменные окружения

Цель: операционные параметры (почта, PayKeeper, интеграции) хранятся в **БД** (`SystemSetting`) и редактируются в **Портал → Настройки**. Секреты в БД **шифруются** (ключ — `NEXTAUTH_SECRET`).

**Локально и на текущем проде с SQLite** «БД» — это **файл** по `DATABASE_URL` (например `file:./dev.db` в каталоге `prisma/`). Таблица `SystemSetting` с ключами `site_url`, `nextauth_url` и др. лежит в этом же файле: бэкап настроек = копия `.db` (плюс по желанию экспорт из админки). При смене PostgreSQL в `schema.prisma` смысл не меняется — данные по-прежнему в БД, меняется только движок.

## Только в `.env` / панели хостинга (bootstrap)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | Подключение Prisma до чтения настроек. **VPS с SQLite (avaterra.pro):** предпочтительно абсолютный путь, например `file:/opt/ALETHEIA/prisma/dev.db` в `.env` — см. [Production-Server.md — §5](Production-Server.md). |
| `NEXTAUTH_SECRET` | Подпись сессий NextAuth и расшифровка секретов в БД (≥ 32 символов в проде) |

Опционально: `NODE_ENV`, переменные сборки (`NEXT_PUBLIC_APP_VERSION`, `VERCEL_GIT_COMMIT_SHA` и т.д. — см. `docs/Deploy.md`).

## Слой чтения

- `getSystemSettings()` — общие поля портала: сначала БД, при пустых значениях — fallback из `NEXT_PUBLIC_URL`, `RESEND_FROM`, `RESEND_NOTIFY_EMAIL`. В том же запросе читается **`nextauth_url`** и через `applyNextAuthUrlToProcessEnv` задаётся `NEXTAUTH_URL` для NextAuth (приоритет над `site_url`).
- `getEnvOverrides()` — ключи API и URL интеграций: сначала БД (с расшифровкой), при отсутствии — `process.env` (`RESEND_API_KEY`, `DEEPSEEK_API_KEY`, `TELEGRAM_BOT_TOKEN`, …).

Список ключей в коде: `lib/settings.ts` (`ENV_OVERRIDE_KEYS`).

## NEXTAUTH_URL

Операционный URL для NextAuth (CSRF, callback) хранится в БД: ключ **`nextauth_url`**, поле в админке **Портал → Настройки** (блок переменных окружения / интеграций). Приоритет при подстановке в `process.env.NEXTAUTH_URL`: **`nextauth_url` из БД → `site_url` из БД → `NEXT_PUBLIC_URL` → `NEXTAUTH_URL` в `.env`** (последний — только если из БД не задано ни одного URL).

Логика в `lib/site-url.ts` (`applyNextAuthUrlToProcessEnv`), вызовы из `getSystemSettings`, `getEnvOverrides` и `instrumentation` (`applyNextAuthUrlFromDatabaseStartup`).

**Локальная разработка:** если в SQLite в поле `site_url` указан продакшен, а вы открываете сайт с `http://localhost:…`, задайте в настройках **`nextauth_url` = `http://localhost:3000`** (своим портом) — значение запишется в тот же файл БД, иначе возможна ошибка **`CLIENT_FETCH_ERROR`** в консоли браузера. Дублировать URL в `.env` не обязательно, если поле уже сохранено в БД.

## Импорт на сервере

После деплоя на Vercel переменные задаются в панели, но не в БД. В **Настройки → Импорт из переменных окружения процесса** администратор может одним действием записать в БД все совпадения (см. `app/api/portal/admin/settings/import-env/route.ts`). Пустые переменные пропускаются.

## Инвентаризация имён `process.env` (для импорта и отладки)

| Ключ в БД | Типичная переменная ОС |
|-----------|-------------------------|
| `site_url` | `NEXT_PUBLIC_URL` |
| `nextauth_url` | `NEXTAUTH_URL` |
| `portal_title` | `PORTAL_TITLE` |
| `resend_from` | `RESEND_FROM` |
| `resend_notify_email` | `RESEND_NOTIFY_EMAIL` |
| `contact_phone` | `CONTACT_PHONE` |
| `company_legal_address` | `COMPANY_LEGAL_ADDRESS` |
| `scorm_max_size_mb` | `SCORM_MAX_SIZE_MB` |
| PayKeeper боевой/тест | `PAYKEEPER_*` |
| Секреты интеграций | `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, … |

Полная таблица соответствий — в `import-env/route.ts`.

## Документация по деплою

См. также `docs/Deploy.md`, `docs/Supabase-Setup.md` (при использовании Supabase).
