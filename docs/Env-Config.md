# Конфигурация: БД и переменные окружения

Цель: операционные параметры (почта, PayKeeper, интеграции) хранятся в **БД** (`SystemSetting`) и редактируются в **Портал → Настройки**. Секреты в БД **шифруются** (ключ — `NEXTAUTH_SECRET`).

**Локально и на текущем проде с SQLite** «БД» — это **файл** по `DATABASE_URL` (например `file:./dev.db` в каталоге `prisma/`). Таблица `SystemSetting` с ключами `site_url`, `nextauth_url` и др. лежит в этом же файле: бэкап настроек = копия `.db` (плюс по желанию экспорт из админки). При смене PostgreSQL в `schema.prisma` смысл не меняется — данные по-прежнему в БД, меняется только движок.

## Только в `.env` / панели хостинга (bootstrap)

Операционные параметры (почта Resend/SMTP, PayKeeper, Telegram, ключи AI и т.д.) настраиваются в **Портал → Настройки** и хранятся в `SystemSetting`. В файле окружения процесса имеет смысл держать в первую очередь то, без чего приложение не стартует или не может расшифровать секреты:

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | Подключение Prisma до чтения настроек. **VPS с SQLite (avaterra.pro):** предпочтительно абсолютный путь, например `file:/opt/ALETHEIA/prisma/dev.db` в `.env` — см. [Production-Server.md — §5](Production-Server.md). |
| `NEXTAUTH_SECRET` | Подпись сессий NextAuth и расшифровка секретов в БД (≥ 32 символов в проде) |

Опционально: `NODE_ENV`, переменные сборки (`NEXT_PUBLIC_APP_VERSION`, `VERCEL_GIT_COMMIT_SHA` и т.д. — см. `docs/Deploy.md`).

**Импорт из env процесса:** список пар «ключ БД ↔ переменная ОС» централизован в `lib/settings-import-env.ts` (тот же набор использует UI импорта и `POST .../settings/import-env`).

## Слой чтения

- `getSystemSettings()` — общие поля портала: сначала БД, при пустых значениях — fallback из `NEXT_PUBLIC_URL`, `RESEND_FROM`, `RESEND_NOTIFY_EMAIL`. В том же запросе читается **`nextauth_url`** и через `applyNextAuthUrlToProcessEnv` задаётся `NEXTAUTH_URL` для NextAuth (приоритет над `site_url`).
- `getEnvOverrides()` — ключи API и URL интеграций: сначала БД (с расшифровкой), при отсутствии — `process.env` (`RESEND_API_KEY`, `SMTP_*`, `EMAIL_TRANSPORT`, `DEEPSEEK_API_KEY`, `TELEGRAM_BOT_TOKEN`, …).

Список ключей в коде: `lib/settings.ts` (`ENV_OVERRIDE_KEYS`).

## NEXTAUTH_URL

Операционный URL для NextAuth (CSRF, callback) хранится в БД: ключ **`nextauth_url`**, поле в админке **Портал → Настройки → Интеграции**. Приоритет при подстановке в `process.env.NEXTAUTH_URL`: **`nextauth_url` из БД → `site_url` из БД → `NEXT_PUBLIC_URL` → `NEXTAUTH_URL` в `.env`** (последний — только если из БД не задано ни одного URL).

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
| Почта SMTP (альтернатива Resend) | `EMAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` |

Полная таблица соответствий — в `lib/settings-import-env.ts` и `app/api/portal/admin/settings/import-env/route.ts`.

**Типовые шаблоны коммуникаций (`CommsTemplate`):** однократное создание недостающих записей по стабильным именам `[AVATERRA] …` — `npm run db:upsert-comms-templates` (перезапись существующих только с флагом `--force`; см. `scripts/upsert-default-message-templates.ts`, тексты по умолчанию — `lib/default-comms-templates.ts`).

## Исходящая почта: Resend и SMTP (Mail.ru и др.)

Отправка идёт через **`lib/email.ts`**: либо **Resend** (если задан API-ключ и выбран транспорт `resend` или авто с ключом), либо **SMTP** (если заданы хост, логин, пароль и выбран `smtp` или авто без Resend).

| Переменная / ключ БД | Назначение |
|----------------------|------------|
| `email_transport` / `EMAIL_TRANSPORT` | Пусто = авто: есть Resend → Resend, иначе при полном SMTP → SMTP. Значения: `resend`, `smtp`. |
| `smtp_host` | Например `smtp.mail.ru` |
| `smtp_port` | `465` (SSL) или `587` (STARTTLS) |
| `smtp_user` | Полный адрес ящика, например учётная запись проекта |
| `smtp_password` | **Пароль приложения** (Mail.ru: настройки → безопасность → пароли для внешних приложений), не обычный пароль входа |
| `smtp_secure` | Опционально: `true` / `false` / `1` / `0`; если пусто — для порта 465 подразумевается SSL |

В блоке **Портал → Настройки → Почта** поле **Email отправителя** (`resend_from`) при SMTP должно совпадать с адресом ящика (иначе провайдер может отклонить письмо). **Email получателя уведомлений** — куда уходит тест и служебные копии.

Настроить SMTP можно в карточке **Исходящая почта** или через `.env` и **Импорт из env**.

Если в админке не заданы поля SMTP, но на сервере заданы **`MAIL_SMTP_HOST`**, **`MAIL_SMTP_USER`**, **`MAIL_SMTP_PASSWORD`** (автономный почтовый стек на том же VPS — см. [Mail-Server.md](Mail-Server.md)), они подставляются в `lib/email.ts` как дополнение к настройкам портала.

Чтобы **полностью перейти на свой SMTP** (Mailcow) и не смешивать его со старым SMTP или Resend из БД, задайте в `.env` **`MAIL_USE_OWN_SMTP=true`** и те же три переменные `MAIL_SMTP_*` — тогда используются только они (`lib/email.ts`, см. `mergeMailStackSmtpFromEnv`).

**Входящие IMAP (модуль синхронизации):** если почтовый сервер отдаёт самоподписанный TLS-сертификат и в админке видно ошибку `self-signed certificate`, в `.env` процесса задайте **`MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=false`** — см. [Mail-Server.md](Mail-Server.md) и [.env.example](../.env.example).

## Автономная почта @avaterra.pro (bootstrap только из `.env`)

Провижининг ящиков Mailcow и хосты IMAP/SMTP для записей **не хранятся в таблице `SystemSetting`** — задаются переменными процесса Next.js на VPS (см. [.env.example](../.env.example), раздел «Автономная почта»):

| Переменная | Назначение |
|------------|------------|
| `MAIL_PROVISIONING_MODE` | `mailcow` или `none` |
| `MAIL_DOMAIN`, `MAIL_IMAP_HOST`, `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` | Домен и подключение к вашему MX |
| `MAILCOW_API_URL`, `MAILCOW_API_KEY` | REST API Mailcow для создания ящиков из админки. Ключ создаётся **один раз** на VPS: `sudo bash scripts/setup-mailcow-api-prod.sh` (записывает переменные в `/opt/ALETHEIA/.env`, рестарт aletheia). Без них режим `none` — только записи в БД, IMAP на Dovecot не совпадёт. |

**Скрипты bootstrap и диагностики (VPS / WSL):**

| Скрипт / npm | Назначение |
|--------------|------------|
| `scripts/append-mail-stack-hosts-prod.sh` | На VPS: дописать `MAIL_IMAP_*`, `MAIL_SMTP_*`, `MAIL_DOMAIN`, `MAIL_PROVISIONING_MODE=mailcow`, `MAILCOW_API_URL` |
| `scripts/setup-mailcow-api-prod.sh` | На VPS: создать ключ Mailcow API + `MAILCOW_API_KEY` в `.env` |
| `scripts/prod-mailcow-create-domain-mailbox-remote.sh` | С WSL: выровнять пароль ящика в MySQL Mailcow (`MAILBOX_EMAIL=…`) |
| `scripts/prod-mailcow-align-password-remote.sh` | С WSL: выровнять пароль через Mailcow API |
| `scripts/prod-inmail-sync-all-remote.sh` | С WSL: синхронизировать все `InboundMailbox`, обновить `lastSyncStatus` |
| `npm run mail:e2e-selfcheck` | С WSL: полный E2E (тестовый ящик, IMAP, SMTP на admin@, sync, cleanup) |

Админка: **Портал → Ящики домена**. Полная инструкция — [Mail-Server.md](Mail-Server.md). Troubleshooting IMAP — [Support.md](Support.md).

## Планировщик (cron)

Для фоновых задач по расписанию используется общий секрет **`CRON_SECRET`** (БД или `.env`), заголовок: `Authorization: Bearer <CRON_SECRET>`.

**Обязателен на проде:** модуль `lib/cron-auth.ts` (`requireCronAuth`) при **отсутствии** секрета возвращает **503** (раньше проверка пропускалась). Без `CRON_SECRET` cron-маршруты недоступны — это ожидаемое поведение. Одноразовая настройка на VPS: `scripts/setup-cron-secret-prod.sh`; проверка: `grep ^CRON_SECRET= /opt/ALETHEIA/.env` (значение не логировать).

| Маршрут | Назначение |
|---------|------------|
| `GET /api/cron/mailings-send` | Запланированные рассылки |
| `GET /api/cron/inmail-sync` | Синхронизация IMAP-ящиков (**Входящие**) |
| `GET /api/cron/installment-payments` | Рассрочка: напоминания, автосписание, overdue |
| `GET /api/cron/blog-telegram-sync` | Перенос новых постов Telegram-канала в блог (канал — настройка `blog_telegram_channel`, пусто = выключено) |
| `GET /api/cron/reconcile-enrollments` | Сверка «оплачено, но доступа нет»: восстановление зачислений (`?repair=0` — только отчёт, без изменений) |

На Vercel добавьте вызовы в [Cron Jobs](https://vercel.com/docs/cron-jobs); на VPS — `scripts/install-aletheia-http-cron.sh` (файл `/etc/cron.d/aletheia-http-cron`) или `crontab` + `scripts/cron-http-call.sh`.

**Пример ручной проверки cron с сервера (подставьте URL и секрет):**

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://ваш-домен/api/cron/mailings-send"
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://ваш-домен/api/cron/inmail-sync"
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://ваш-домен/api/cron/installment-payments"
curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://ваш-домен/api/cron/reconcile-enrollments?repair=0"
```

Ожидается HTTP 200 и JSON с кратким отчётом; при неверном секрете — 401.

**Исходящая почта и диагностика:** все отправки через `lib/email-service.ts` пишут метаданные (без тела письма) в таблицу **`EmailDeliveryLog`** (`module`, получатель, тема, `status`, текст ошибки). Для рассылок и доменных журналов по-прежнему смотрите `MailingLog` / `NotificationLog` / `CommsSend`. Тест Resend из **Настройки** и шаблоны оплаты из того же раздела тоже попадают в общий журнал.

**Входящие IMAP:** в схеме БД предусмотрены поля состояния синка у ящика (`lastSyncStatus`, `lastSyncError` и др.). После включения модуля «Входящие» в админке смотрите их в UI и настройте cron на `inmail-sync`, если маршрут есть в деплое.

Подробный чеклист после изменений кода почты: **`docs/Mail-Module-Verification.md`**.

## Telegram-бот

| Ключ в БД / переменная | Назначение |
|------------------------|------------|
| `telegram_admin_chat_ids` / `TELEGRAM_ADMIN_CHAT_IDS` | Chat ID администраторов для оповещений о событиях (заявки, регистрации, оплаты, тикеты). Через запятую. Команда бота `/myid` или `/admin_on`. |
| `telegram_bot_token` / `TELEGRAM_BOT_TOKEN` | Токен от [@BotFather](https://t.me/BotFather). В репозитории и в документации **не хранится** — только в БД (Портал → Настройки → Переменные окружения) или в `.env`. |
| `telegram_webhook_secret` / `TELEGRAM_WEBHOOK_SECRET` | Опционально: значение для заголовка `X-Telegram-Bot-Api-Secret-Token` при вызове webhook ([Bot API: setWebhook](https://core.telegram.org/bots/api#setwebhook), параметр `secret_token`). |
| `HTTPS_PROXY` / `https_proxy` / `HTTP_PROXY` / `http_proxy` | Опционально: исходящий HTTP(S)-прокси для запросов к `api.telegram.org` (отправка сообщений, тест «Проверить Telegram»). Задаётся **только** в окружении процесса Node (`.env` или unit systemd), не в таблице настроек. См. `lib/telegram-fetch.ts`. |

**Webhook приложения (публичный URL):** `POST /api/portal/telegram/webhook` — полный URL на проде: `https://avaterra.pro/api/portal/telegram/webhook` (подставьте свой `site_url`, если домен другой).

Пошаговое восстановление токена, регистрация `setWebhook` у Telegram и диагностика доступности API с VPS — **[Support.md — Telegram-бот](Support.md#telegram-бот-webhook-токен-блокировки)**.

См. также `docs/Deploy.md`, `docs/Supabase-Setup.md` (при использовании Supabase).
