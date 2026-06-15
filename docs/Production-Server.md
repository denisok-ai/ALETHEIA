# Продуктивный сервер AVATERRA (ALETHEIA)

Документ описывает **текущую конфигурацию** VPS, **недавние изменения** в коде и деплое, **порядок обновления** и проверки. Детали Vercel и общий чек-лист — в [Deploy.md](Deploy.md); отладка и 502 — в [Server-Debug.md](Server-Debug.md).

---

## 1. Идентификация

| Параметр | Значение |
|----------|-----------|
| **IP** | `95.181.224.70` |
| **Домен** | https://avaterra.pro |
| **ОС** | Ubuntu |
| **Каталог приложения** | `/opt/ALETHEIA` |
| **Репозиторий GitHub** | `https://github.com/denisok-ai/ALETHEIA` (ветка `main`) |
| **Доступ** | SSH по ключу (`ssh root@95.181.224.70`) |

**Почему `ALETHEIA`, а не `AVATERRA`:** на сервере код и сборка изначально развёрнуты в **`/opt/ALETHEIA`** (как в репозитории GitHub `ALETHEIA`). Локально проект часто лежит в `~/projects/AVATERRA` — это другой путь **только на твоей машине**; на VPS «историческая» и **единственная рабочая** папка продакшена — **`/opt/ALETHEIA`**. Любые команды `cd`, копирование `dev.db`, правка `.env` и деплой — только относительно этого каталога.

Один «источник правды» для кода и `.next` на машине — **только** `/opt/ALETHEIA`. Второй клон в `/var/www/...` с параллельным процессом на том же порту приводит к 502 и «старой» админке.

---

## 2. Процесс приложения (Node / Next.js)

- **Рекомендуемый запуск:** **systemd** — unit `aletheia.service`.
- **Пример unit:** [`scripts/systemd/aletheia.service.example`](../scripts/systemd/aletheia.service.example) — поля **`WorkingDirectory=/opt/ALETHEIA`** и `ExecStart=npm run start` должны указывать на **тот же** каталог, где выполняли `npm run build`.
- **Порт upstream для nginx:** по умолчанию **3000** (переопределяется `PORT` в `.env` — тогда в nginx `proxy_pass` должен совпадать).
- **`NODE_ENV`:** `production` (в unit или окружении).
- **Секреты и URL:** файл **`.env`** в `/opt/ALETHEIA` (в git не коммитится). Список переменных — [.env.example](../.env.example), подробнее — [Env-Config.md](Env-Config.md).
- **`NEXTAUTH_URL`:** предпочтительно задавать **`nextauth_url` в БД** (Портал → Настройки → Интеграции), а не дублировать в `.env`; в `.env` оставляют при необходимости только bootstrap вместе с `DATABASE_URL` / `NEXTAUTH_SECRET` — см. [Env-Config.md](Env-Config.md). Если в `.env` указан прод-URL без записи в БД для dev — возможны предупреждения next-auth в логах.
- **SQLite на этом VPS:** в `.env` задать `DATABASE_URL="file:/opt/ALETHEIA/prisma/dev.db"` (см. §5).
- **Опционально:** `npm install sharp` в каталоге приложения — ускорение оптимизации изображений Next.js.

**PM2:** на проде avaterra.pro — **только systemd** (`aletheia.service`). PM2 `aletheia`/`avaterra` не должен слушать порт 3000 (конфликт EADDRINUSE и «старый» build). Скрипт `deploy-rsync-from-local.sh` при деплое выполняет `pm2 delete aletheia` и не поднимает PM2 как fallback. Отдельный unit **`aletheia-telegram-poll.service`** — long-polling worker бота (не Next.js, порт 3000 не занимает).

---

## 3. Nginx

- **Конфиг сайта:** `/etc/nginx/sites-available/aletheia` → симлинк `sites-enabled/aletheia`.
- **Схема:** HTTPS (443) и/или HTTP → `proxy_pass http://127.0.0.1:3000` (или другой порт из `.env`).
- **Кеш `proxy_cache`:** если для `location /` включены `proxy_cache` и длинный `proxy_cache_valid 200`, nginx может отдавать **устаревший HTML/RSC** после деплоя. Рекомендация: для динамики не кешировать ответы приложения (`proxy_no_cache` / отдельный `location` только для `/_next/static/`). Пример без кеша HTML — [`scripts/nginx-aletheia.conf`](../scripts/nginx-aletheia.conf).
- **Заголовки безопасности:** в приложении заданы `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` ([`next.config.mjs`](../next.config.mjs) → `headers`). При дублировании тех же имён в nginx убедитесь, что значения совпадают; **HSTS** и принудительный **HTTPS** обычно задаются в nginx/certbot, не в Next.js.
- **После правок:** `sudo nginx -t && sudo systemctl reload nginx`.

**Чеклист обзора (при инцидентах или раз в квартал):** убедиться, что для HTML/RSC не включён агрессивный `proxy_cache` на `location /`; при медленном `next/image` на сервере — установлен **sharp** в `/opt/ALETHEIA` (см. §2). План перехода на **PostgreSQL** при росте нагрузки — [Deploy.md](Deploy.md) (раздел про БД).

---

## 4. SSL и доверие к CA

- **Let's Encrypt** (certbot + nginx):
  - **`avaterra.pro`** и **`www.avaterra.pro`** — прод-сайт; после продления **2026-06-15** действует до **13 сентября 2026**.
  - **`mail.avaterra.pro`** — отдельный сертификат для веб-почты/Mailcow; после продления **2026-06-15** действует до **13 сентября 2026**.
- Проверка: `sudo certbot certificates` или `curl -sS https://avaterra.pro/api/health` (ожидается **200**).
- После продления: `sudo nginx -t && sudo systemctl reload nginx`.
- Дополнительно на сервер установлен корневой сертификат **GlobalSign** (системное хранилище `ca-certificates`), чтобы исходящие HTTPS-запросы Node/утилит доверяли нужным цепочкам.

---

## 5. База данных (Prisma)

**Источник правды на конкретном сервере** — значение **`DATABASE_URL`** в окружении **процесса** Next.js (обычно из `/opt/ALETHEIA/.env` через `EnvironmentFile` в systemd), а не комментарии в репозитории.

| Режим | Когда используется |
|--------|-------------------|
| **SQLite (локально)** | `DATABASE_URL="file:./dev.db"` — файл **`prisma/dev.db`** относительно каталога со `schema.prisma` (см. документацию Prisma). |
| **SQLite (VPS avaterra.pro)** | **Рекомендуется абсолютный URL:** `DATABASE_URL="file:/opt/ALETHEIA/prisma/dev.db"` в **`/opt/ALETHEIA/.env`**. Так Prisma, `sqlite3` и скрипты (`npx tsx scripts/import-services-replace.ts`) однозначно попадают в один файл; после инцидента 2026-04 исключены расхождения «в БД 3 строки `Service`, а API отдаёт старые slug» при относительном `file:./dev.db`. |
| **PostgreSQL** | Явный URL `postgresql://…` — целевой вариант для масштабирования и нескольких воркеров; настройка — [Deploy.md — БД для продакшена](Deploy.md). |

**Риск «две базы»:** скрипты и `sqlite3` правят тот `dev.db`, который соответствует **загруженному** `.env`. Если unit systemd указывает **другой** `WorkingDirectory` или в оболочке задали `DATABASE_URL` без записи в `.env`, сайт может читать не тот файл. Полный снимок: [`scripts/prod-diagnostics.sh`](../scripts/prod-diagnostics.sh).

**После правки `dev.db`:** `sudo systemctl restart aletheia` (открытый SQLite у старого процесса). **Если `/api/health` показывает старый `commit`, а `git log -1` уже новый** — пересобрать приложение (`scripts/deploy-pull.sh` или `rm -rf .next && npm run build`) и снова рестарт: `commit` в health берётся из **`NEXT_PUBLIC_BUILD_COMMIT` на этапе `next build`** ([`next.config.mjs`](../next.config.mjs)).

В репозитории в `schema.prisma` для локальной разработки задан `provider = "sqlite"`; смена провайдера на PostgreSQL на VPS — отдельная процедура миграции данных, не обязательная для уже работающего SQLite.

---

## 6. Изменения в коде и инфраструктуре (релевантно проду)

Кратко, что влияет на сборку и портал:

| Тема | Суть |
|------|------|
| **Портал (RSC)** | Тонкие `app/portal/*/layout.tsx` + клиентские оболочки `AdminPortalShell` / `ManagerPortalShell` / `StudentPortalShell` — нельзя передавать **функции** в пропах клиентским компонентам (ошибка `navFooter: function`). |
| **instrumentation** | `instrumentation.ts` вызывает только **`lib/settings-startup.ts`** (чтение `site_url` из БД для `NEXTAUTH_URL`), без импорта всего `lib/settings.ts` с `encrypt` — иначе при `next build` webpack ломался на модуле `crypto`. |
| **encrypt** | Импорт из **`node:crypto`**; в **`next.config.mjs`** для server-бандла в `externals` добавлены `crypto` и `node:crypto` (страховка). |
| **deploy-pull.sh** | Шаг **5b:** очистка **`/var/cache/nginx`** (или встроенная очистка, если нет `nginx-clear-proxy-cache.sh`) + `nginx reload` при наличии прав; шаги **6–7:** проверка `127.0.0.1:$PORT/api/health` и внешнего URL. |
| **Деплой без git** | С ПК (WSL): **`npm run deploy:rsync`** → [`scripts/deploy-rsync-from-local.sh`](../scripts/deploy-rsync-from-local.sh) (по умолчанию `root@95.181.224.70:/opt/ALETHEIA`). Локальный **`next build` до** остановки сервиса на VPS; rsync **`lib/`**, **`app/`**, `.next/`, `scripts/`; на сервере — только **systemd** (PM2 удаляется), рестарт `aletheia` + **`aletheia-telegram-poll.service`**. **Не запускать** `deploy:rsync` на самом VPS. |
| **Mailcow (черновик)** | [`scripts/setup-mailcow-docker-vps.sh`](../scripts/setup-mailcow-docker-vps.sh) — на VPS от root: Docker + clone Mailcow в `/opt/mailcow-dockerized`; дальше `generate_config.sh`, TLS/DNS — [Mail-Server.md](Mail-Server.md). |
| **Telegram-бот** | **Long-polling:** `aletheia-telegram-poll.service` → `scripts/telegram-poll-daemon.ts` → `lib/telegram-long-poll.ts`; webhook **не** регистрируется (`getWebhookInfo.url` пуст). Токен и Chat ID — БД (Портал → Настройки → Интеграции); «Обновить команды бота» — `deleteWebhook` + `setMyCommands`. Исходящие вызовы — `HTTPS_PROXY` / `TELEGRAM_API_TIMEOUT_MS` в `.env`. См. [Support.md — Telegram](Support.md#telegram-бот-long-polling-токен-блокировки). |

## 6.1 Развёртывание приложения без git на сервере + почта

1. Собрать приложение локально и выгрузить на VPS: **`npm run deploy:rsync`** (см. §7 вариант B ниже). Файл `.env` на сервере **не перезаписывается** — добавьте в него переменные `MAIL_*` после установки Mailcow.
2. Если продовые данные SQLite не нужны: **`RESET_AND_SEED=1 npm run deploy:rsync`** — полный сброс БД и seed на сервере (осторожно).

---

## 7. Порядок обновления продакшена

### Вариант A — через Git (основной)

1. На **рабочей машине:** закоммитить и отправить изменения:  
   `git push origin main`.
2. По SSH на сервер:  
   `ssh root@95.181.224.70`
3. Выполнить:  
   `cd /opt/ALETHEIA && sudo bash scripts/deploy-pull.sh`

Скрипт: `git pull` → зависимости → `prisma generate` → `prisma migrate deploy` → **остановка** `aletheia.service` → удаление `.next` → `npm run build` → рестарт **`aletheia.service`** (systemd-only на проде) → при возможности сброс proxy-kеша nginx. Poll-worker: `sudo systemctl restart aletheia-telegram-poll.service`.

**Переменные (опционально):** `DEPLOY_ROOT`, `GIT_BRANCH`, `SKIP_NGINX_CACHE=1`, `APP_PORT` — см. комментарии в [`scripts/deploy-pull.sh`](../scripts/deploy-pull.sh).  
**С ПК:** [`scripts/deploy-remote.sh`](../scripts/deploy-remote.sh) (`npm run deploy:remote`) передаёт на сервер `SKIP_NGINX_CACHE`; шаг **5b** в `deploy-pull.sh` очищает `proxy_cache` (см. [`scripts/nginx-clear-proxy-cache.sh`](../scripts/nginx-clear-proxy-cache.sh)) и делает `nginx reload`. Если каталога кеша нет — скрипт не падает, при необходимости всё равно выполняется reload.  
**На тестовом стенде** (не на проде с реальными данными): `RESET_AND_SEED=1` — полный сброс БД и seed.

### Вариант B — без `git pull` на сервере (rsync с WSL)

1. На **ПК в WSL**, в корне репозитория:  
   `cd ~/projects/AVATERRA`
2. При необходимости:  
   `export DEPLOY_SSH_IDENTITY="$HOME/.ssh/ваш_ключ"`
3. Запуск:  
   `npm run deploy:rsync`

Локально выполняется **`next build`** (при неудаче деплой прерывается — `.next` на сервере не затирается), затем на сервере останавливается `aletheia`, rsync: `.next/`, `public/`, **`lib/`**, **`app/`**, `scripts/`, `prisma/` (без локальных `.db`), `package.json`, lockfile, `next.config.mjs`, `middleware.ts`; на сервере — `npm ci`, `prisma migrate deploy`, `prisma generate`, очистка кеша nginx (если есть), **`systemctl restart aletheia`** и **`aletheia-telegram-poll.service`**, удаление PM2 `aletheia`. Файл **`.env` на сервере не перезаписывается**.

**Замена продовой SQLite локальной базой** (осознанно, прод-данные перезаписываются содержимым `prisma/dev.db` с вашего ПК):  
`npm run deploy:rsync:with-db` или `DEPLOY_COPY_LOCAL_DB=1 npm run deploy:rsync`. Перед этим локально должна быть актуальная сборка и файл `prisma/dev.db`; после копирования на сервере по-прежнему выполняются `migrate deploy` и `generate`.

### Если `git pull` на сервере конфликтует с локальными правками

Когда прод должен **полностью совпадать с `origin/main`**, а на диске сервера были ручные правки или неотслеживаемые файлы:

```bash
cd /opt/ALETHEIA
sudo git fetch origin
sudo git reset --hard origin/main
sudo git clean -fd
sudo bash scripts/deploy-pull.sh
```

**Внимание:** `git clean -fd` удаляет неотслеживаемые файлы в репозитории (игнорируемые git обычно не трогает без `-x`). Неотслеживаемые каталоги в `public/` (например загруженные картинки) могут пропасть — делайте бэкап при необходимости.

---

## 8. Проверка после выката

```bash
# На сервере
curl -sS -o /dev/null -w "localhost: %{http_code}\n" http://127.0.0.1:3000/api/health
sudo systemctl status aletheia.service --no-pager -l

# С любой машины
curl -sS https://avaterra.pro/api/health
```

В ответе `/api/health` — `version` и **`commit`** (короткий SHA **текущей production-сборки**, задаётся при `next build` через `NEXT_PUBLIC_BUILD_COMMIT` в [`next.config.mjs`](../next.config.mjs)). Сверка: `cd /opt/ALETHEIA && git rev-parse --short HEAD` — после свежего деплоя должен совпадать с `commit` в JSON (если нет — не выполняли `next build` после `git pull`). Заголовки `X-App-Version` / `X-Build-Commit` при наличии.

Дополнительно: `curl -sS http://127.0.0.1:3000/api/shop/products | head -c 800` — витрина тарифов из БД.

Убедиться, что админский layout обновился:  
`head -n 12 /opt/ALETHEIA/app/portal/admin/layout.tsx` — ожидается обёртка **`AdminPortalShell`**, а не длинный список иконок Lucide в layout.

---

## 9. Расширенная диагностика (VPS)

Один запуск собирает **только чтение** (порты, systemd, nginx, кандидаты `.env` / `*.db`, выборка `Service` из найденных SQLite, `curl` health и shop).

```bash
cd /opt/ALETHEIA
git pull origin main   # чтобы был актуальный prod-diagnostics.sh
bash scripts/prod-diagnostics.sh | tee ~/prod-audit-$(date +%F-%H%M).txt
# эквивалентно: npm run prod:diagnostics
```

Другой корень приложения (редко): `PROD_ROOT=/path/to/app bash scripts/prod-diagnostics.sh`.

Сохранённый лог приложить к тикету или внести факты в раздел **«12. Зафиксировано на сервере»** ниже (без секретов).

---

## 10. Уборка дубликатов (чеклист)

Делать **после** анализа отчёта диагностики. Не удалять каталоги и `.db`, пока не ясно, какой процесс слушает порт из `proxy_pass` и какой `WorkingDirectory` у unit.

1. Оставить **один** корень деплоя для avaterra.pro — **`/opt/ALETHEIA`** (или задокументировать иной, но единственный).
2. Остановить дубликаты: второй **PM2**-процесс на том же порту, старый клон с ручным `npm start`, лишний unit.
3. В **`/etc/systemd/system/aletheia.service`**: `WorkingDirectory` = этот корень; **`EnvironmentFile=-/opt/ALETHEIA/.env`** (как в [`scripts/systemd/aletheia.service.example`](../scripts/systemd/aletheia.service.example)), чтобы те же `DATABASE_URL` использовали и приложение, и ручные `npx tsx scripts/…`.
4. Бэкап канонической БД: `cp prisma/dev.db "prisma/dev.db.bak-$(date +%Y%m%d%H%M)"` в корне деплоя. Файлы `prisma/dev.db.bak*` **не коммитить** в Git (в `.gitignore`); при необходимости хранить копии вне репозитория (`~/backups/`).
5. **После любой перезаписи `prisma/dev.db`** (импорт, `sqlite3 < …sql`, восстановление из бэкапа) выполните **`sudo systemctl restart aletheia`**. Иначе уже запущенный Node держит открытый дескриптор SQLite на **старом inode**: `sqlite3` и скрипты видят новые данные, а `curl localhost:3000/api/…` — старые (как в отчёте: в БД 3 `Service`, в API пять slug).
6. Лишние **`*.db`** и **`.next`** в **неиспользуемых** клонах (`/var/www/…`) — удалять только если отчёт подтверждает, что на них не ссылается ни systemd, ни PM2, ни `lsof` на порту приложения.
7. `sudo systemctl daemon-reload && sudo systemctl restart aletheia` (или имя вашего unit) после правок unit; после смены БД — только рестарт; затем `curl` `/api/health` и `/api/shop/products`.

Синхронизация витрины тарифов: [`scripts/import-services-replace.ts`](../scripts/import-services-replace.ts) или [`prisma/data/replace-services-sqlite.sql`](../prisma/data/replace-services-sqlite.sql) (нужен `sqlite3` в PATH). См. также [`scripts/check-database-url.sh`](../scripts/check-database-url.sh).

---

## 11. Диагностика (кратко)

| Симптом | Куда смотреть |
|---------|----------------|
| **502** от nginx | `curl` к `127.0.0.1:3000/api/health`; `journalctl -u aletheia.service -n 80`; совпадение порта с nginx. |
| Старый UI после деплоя | Кеш nginx `proxy_cache`; жёсткое обновление браузера; очистка `/var/cache/nginx`. |
| Импорт БД «сработал», сайт не меняется | **`systemctl restart aletheia`**; в `.env` для SQLite на VPS — абсолютный `file:/opt/ALETHEIA/prisma/dev.db` (§5). Иначе §9 (две копии проекта / другой `DATABASE_URL`). |
| `sqlite3` показывает новые строки, API — старые | Рестарт сервиса + абсолютный `DATABASE_URL`; при старом **`commit`** в `/api/health` — **`npm run build`** (или `deploy-pull.sh`). |
| Ошибки RSC / `navFooter` | Актуальный код с клиентскими shell layout (см. п. 6). |

Подробнее — [Server-Debug.md](Server-Debug.md).

---

## 12. Зафиксировано на сервере

*Обновляйте таблицу после смены хоста, домена или способа запуска. После `git pull` на VPS полезно прогнать **раздел 9** и при необходимости **раздел 10**.*

| Поле | Значение (актуально на 2026-06-15) |
|------|-------------------------------------|
| Дата аудита | **2026-06-15** (деплой **3.5.5**, рестарт `aletheia-jobs`) |
| Версия приложения | **3.5.5** (`/api/health` → `version`, **200**) |
| SSL Let's Encrypt | `avaterra.pro` + `www`, `mail.avaterra.pro` — продлены **2026-06-15**, истекают **2026-09-13** |
| Хост VPS | p941004.kvmvps, Ubuntu 24.04 LTS, IP 95.181.224.70 |
| Активный корень приложения | /opt/ALETHEIA |
| Git на проде (после аудита) | **bef9e6d** — deploy 3.5.5; `/api/health` → `commit` совпадает |
| Документация (репо) | **8348dfe**, **b73e914**, **81f551b** (audit §12); **f84ccfe** (Diary CRM); код backfill — **c4f5ed4** |
| Unit systemd | aletheia.service: `EnvironmentFile=-/opt/ALETHEIA/.env`, `DATABASE_URL=file:/opt/ALETHEIA/prisma/dev.db` (абсолютный путь в `.env`), `NODE_OPTIONS=--max-old-space-size=512`, `Restart=always`, `WorkingDirectory=/opt/ALETHEIA` |
| Порт Node | 3000 (nginx → 127.0.0.1:3000) |
| Тип БД | SQLite, /opt/ALETHEIA/prisma/dev.db; миграции Prisma — без pending |
| CRM (после аудита) | Таблица `Lead` была **0 строк** (не баг UI); backfill из заказов — **7 лидов** (`npm run db:backfill-leads-from-orders`, см. Support.md) |
| Файл nginx vhost | /etc/nginx/sites-enabled/aletheia — `location /` без proxy_cache (только `/_next/static/` и `/_next/image`) |
| fail2ban | Установлен; jails: **sshd**, **nginx-http-auth**, **nginx-limit-req** (`/etc/fail2ban/jail.local`) |
| Mailcow | /opt/mailcow-dockerized; `docker-compose.override.yml` — лимиты RAM mysql/sogo/rspamd/clamd; **SOGo включён** |
| Docker | `/etc/docker/daemon.json` — json-file, max-size=10m, max-file=3 |
| journald | `SystemMaxUse=500M` в `/etc/systemd/journald.conf`; освобождено **~2.9 GB** на диске |
| Бэкап перед работами | `/root/backups/20260614/` — dev.db.bak (~5.1 MB), public-uploads.tar.gz (~1.4 GB), .env.bak |
| PM2 | Дубликат **aletheia** удалён (~657k restarts); рабочий процесс Next.js — **только systemd**; PM2 не используется как fallback при деплое |
| Telegram poll worker | **`aletheia-telegram-poll.service`** — `scripts/telegram-poll-daemon.ts`, offset `/var/lib/aletheia/telegram-poll-offset.json`; webhook **не** зарегистрирован |
| Content jobs worker | **`aletheia-jobs.service`** — `scripts/jobs-daemon.ts` (Site Radar, weekly plan, daily publish); лог `/var/log/aletheia-jobs.log` |
| DenisBot1 (Python) | **Не развёрнут** на VPS (2026-06-15); единый бот — TypeScript long-poll |
| Скрипт аудита | [`scripts/run-prod-audit.sh`](../scripts/run-prod-audit.sh) (WSL → SSH) + [`scripts/prod-audit-remote.sh`](../scripts/prod-audit-remote.sh) на VPS (фазы 0–6) |

---

## 13. Скрипты (справочник)

| Файл | Назначение |
|------|------------|
| [`scripts/prod-diagnostics.sh`](../scripts/prod-diagnostics.sh) | Расширенная диагностика VPS (read-only), §9. |
| [`scripts/run-prod-audit.sh`](../scripts/run-prod-audit.sh) | С ПК (WSL): копирует и запускает `prod-audit-remote.sh` на VPS; лог в `/tmp/prod-audit-*.log`. Аргумент — номер фазы или `all`. |
| [`scripts/prod-audit-remote.sh`](../scripts/prod-audit-remote.sh) | На сервере: бэкап, deploy, fail2ban, Mailcow limits, Docker log rotation, проверки (фазы 0–6). |
| [`scripts/backfill-leads-from-orders.ts`](../scripts/backfill-leads-from-orders.ts) | Восстановление CRM из заказов: `npm run db:backfill-leads-from-orders` (`--dry-run`, затем `BACKFILL_CONFIRM=YES`). |
| [`scripts/check-database-url.sh`](../scripts/check-database-url.sh) | Кратко: тип `DATABASE_URL` и путь к SQLite. |
| [`scripts/deploy-pull.sh`](../scripts/deploy-pull.sh) | Полный цикл на **сервере** после `git push`. |
| [`scripts/deploy-rsync-from-local.sh`](../scripts/deploy-rsync-from-local.sh) | Деплой с **WSL** без обновления git на VPS. |
| [`scripts/nginx-clear-proxy-cache.sh`](../scripts/nginx-clear-proxy-cache.sh) | Только сброс proxy-кеша nginx + reload (нужен root). |
| [`scripts/nginx-aletheia.conf`](../scripts/nginx-aletheia.conf) | Пример reverse proxy **без** кеша HTML для Next. |
| [`scripts/systemd/aletheia.service.example`](../scripts/systemd/aletheia.service.example) | Пример unit systemd. |

**npm на ПК:** `npm run deploy:rsync` — обёртка над rsync-скриптом.

---

## 14. Схема трафика

```
Пользователь
  → https://avaterra.pro:443 (nginx + TLS, LE до 2026-09-13)
  → http://127.0.0.1:3000 (Next.js, systemd aletheia.service)

Telegram Bot API (исходящий getUpdates + sendMessage)
  → aletheia-telegram-poll.service (long-poll worker, не порт 3000)
  → lib/telegram-long-poll.ts → routeTelegramUpdate
  → опционально HTTPS_PROXY в .env (блокировка api.telegram.org из РФ)

Фоновые задачи SMM / Site Radar
  → aletheia-jobs.service → scripts/jobs-daemon.ts → lib/content/jobs/scheduler.ts
```

---

## 15. CI / GitHub Actions

При настройке CI: секреты `DEPLOY_HOST`, пользователь, SSH-ключ; см. комментарии в [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) и [`.github/workflows/build.yml`](../.github/workflows/build.yml).
