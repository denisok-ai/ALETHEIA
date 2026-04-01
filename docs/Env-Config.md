# Конфигурация: БД и переменные окружения

Цель: операционные параметры (почта, PayKeeper, интеграции) хранятся в **БД** (`SystemSetting`) и редактируются в **Портал → Настройки**. Секреты в БД **шифруются** (ключ — `NEXTAUTH_SECRET`).

## Только в `.env` / панели хостинга (bootstrap)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | Подключение Prisma до чтения настроек |
| `NEXTAUTH_SECRET` | Подпись сессий NextAuth и расшифровка секретов в БД (≥ 32 символов в проде) |

Опционально: `NODE_ENV`, переменные сборки (`NEXT_PUBLIC_APP_VERSION`, `VERCEL_GIT_COMMIT_SHA` и т.д. — см. `docs/Deploy.md`).

## Слой чтения

- `getSystemSettings()` — общие поля портала: сначала БД, при пустых значениях — fallback из `NEXT_PUBLIC_URL`, `RESEND_FROM`, `RESEND_NOTIFY_EMAIL`.
- `getEnvOverrides()` — ключи API и URL интеграций: сначала БД (с расшифровкой), при отсутствии — `process.env` (`RESEND_API_KEY`, `DEEPSEEK_API_KEY`, `TELEGRAM_BOT_TOKEN`, …).

Список ключей в коде: `lib/settings.ts` (`ENV_OVERRIDE_KEYS`).

## Импорт на сервере

После деплоя на Vercel переменные задаются в панели, но не в БД. В **Настройки → Импорт из переменных окружения процесса** администратор может одним действием записать в БД все совпадения (см. `app/api/portal/admin/settings/import-env/route.ts`). Пустые переменные пропускаются.

## Инвентаризация имён `process.env` (для импорта и отладки)

| Ключ в БД | Типичная переменная ОС |
|-----------|-------------------------|
| `site_url` | `NEXT_PUBLIC_URL` |
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
