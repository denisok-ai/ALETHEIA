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
- **Привязка на проде:** `npm run start` в `package.json` задаёт **`next start -H 127.0.0.1`** — Node слушает только **127.0.0.1:3000**; снаружи доступен только через nginx (443). Не открывать :3000 в ufw.
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
- **Заголовки безопасности:** в приложении заданы `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, **Content-Security-Policy** и `Permissions-Policy` ([`next.config.mjs`](../next.config.mjs) → `headers`). CSP: `default-src 'self'`, `object-src 'none'`, `frame-src 'self'`. При дублировании тех же имён в nginx убедитесь, что значения совпадают; **HSTS** и принудительный **HTTPS** обычно задаются в nginx/certbot, не в Next.js.
- **SCORM static (`/uploads/scorm/`):** на проде — nginx **`auth_request`** → внутренний `location = /internal/scorm-auth-check` → `GET /api/portal/scorm/access-check` (с cookie сессии). Без авторизации — **401/403**. Установка/патч: [`scripts/apply-nginx-scorm-auth-prod.sh`](../scripts/apply-nginx-scorm-auth-prod.sh). Проверка: `curl -s -o /dev/null -w '%{http_code}' https://avaterra.pro/uploads/scorm/` без cookie → не 200.
- **Приватная статика (`/uploads/media/`, `/uploads/verifications/`):** аналогично SCORM — nginx **`auth_request`** → `location = /internal/uploads-auth-check` → `GET /api/portal/uploads/access-check` (нужна сессия). Установка/патч (после деплоя приложения с этим маршрутом): [`scripts/apply-nginx-uploads-auth-prod.sh`](../scripts/apply-nginx-uploads-auth-prod.sh). В приложении та же отсечка продублирована в [`middleware.ts`](../middleware.ts) (dev и деплой без nginx-патча). Обложки товаров `/uploads/services/` остаются публичными.
- **После правок:** `sudo nginx -t && sudo systemctl reload nginx`.
- **`sites-enabled/aletheia` — симлинк на `sites-available/aletheia`** (исправлено 2026-07-16: был обычным файлом, из-за чего патчи в `sites-available` не действовали и SCORM-auth не работал). Править только `sites-available`.

## Бэкапы в Google Drive (настроено 2026-07-16)

- **Что:** ежедневно 03:30 MSK — SQLite-снапшот БД, `.env`, nginx-конфиги, cron, systemd-юниты → tar.gz, шифрование gpg AES256 → `gdrive:avaterra-backups/daily/`. По воскресеньям дополнительно `rclone sync public/uploads` (SCORM/медиа) → `gdrive:avaterra-backups/uploads/`.
- **Ротация:** Drive — 10 дней (daily), локальный staging `/root/backups/gdrive-staging` — 7 дней.
- **Скрипты:** [`scripts/backup-gdrive-prod.sh`](../scripts/backup-gdrive-prod.sh) (установлен как `/usr/local/bin/aletheia-backup-gdrive.sh`), установка — [`scripts/setup-backup-gdrive-prod.sh`](../scripts/setup-backup-gdrive-prod.sh); cron — `/etc/cron.d/aletheia-backup-gdrive`; лог — `/var/log/aletheia-backup.log`.
- **Секреты:** rclone-токен — `/root/.config/rclone/rclone.conf` (600); passphrase шифрования — `/root/.backup-passphrase` (600). **Копию passphrase хранить вне сервера** — без неё бэкапы не расшифровать.
- **Восстановление:** `rclone copy gdrive:avaterra-backups/daily/aletheia-<TS>.tar.gz.gpg . && gpg --batch --passphrase-file /root/.backup-passphrase -d aletheia-<TS>.tar.gz.gpg | tar -xz` (внутри `dev.db`, `env`, конфиги). Проверка выполнена 2026-07-16: расшифровка + `PRAGMA integrity_check` = ok.

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
| **Безопасность (2026-07-10)** | Код: `lib/cron-auth.ts` (обязательный `CRON_SECRET`), rate limits, маскировка секретов в admin GET, CSP в `next.config.mjs`, health без leak ошибок БД. VPS: ufw, sshd keys-only :22, HTTP cron, SCORM auth_request. См. §12, §13, [Diary.md — 2026-07-10](Diary.md). |

## 6.2 Безопасность продуктивного VPS (2026-07-10)

Краткий порядок первичного hardening (на сервере от root, каталог `/opt/ALETHEIA`):

1. **Бэкап и базовый hardening:** `sudo bash scripts/security-hardening-prod.sh` — ufw **22/80/443** + Mailcow **25/587/993**, sshd drop-in (порт **22**, `PasswordAuthentication no`, `PubkeyAuthentication yes`), chmod **600** на `.env` и `prisma/dev.db`, HSTS в nginx.
2. **CRON_SECRET:** `sudo bash scripts/setup-cron-secret-prod.sh` → добавить секрет в `.env` (не коммитить).
3. **HTTP cron:** `sudo bash scripts/install-aletheia-http-cron.sh` → `/etc/cron.d/aletheia-http-cron` (рассылки */5, IMAP */15, рассрочка hourly) через `scripts/cron-http-call.sh`.
4. **Фаза 2 (сеть):** `sudo bash scripts/security-phase2-prod.sh` — подтверждение bind 127.0.0.1, DOCKER-USER для dev-портов Docker. **Не ставить** `iptables-persistent` — конфликтует с ufw (см. инциденты ниже).
5. **SCORM nginx:** `sudo bash scripts/apply-nginx-scorm-auth-prod.sh`.
6. **Пост-настройка:** `sudo bash scripts/security-post-setup-prod.sh` — шифрование бэкапов `.env` (gpg), закрытие лишних ufw-правил (5173).

**Верификация (read-only, раз в квартал или после инцидента):**

```bash
cd /opt/ALETHEIA
sudo bash scripts/security-verify-prod.sh | tee ~/security-verify-$(date +%F).txt
```

Ожидается `Summary: FAIL=0`. При сбое ufw после iptables: `sudo bash scripts/restore-ufw-prod.sh`.

**Перед reload sshd:** `sudo bash scripts/ssh-safety-guard.sh` — проверка порта 22 и PubkeyAuthentication.

**Инциденты (2026-07-10):** установка `iptables-persistent` дважды приводила к **deinstall ufw** — правила firewall сбрасывались; восстановлено `restore-ufw-prod.sh` (включая порты Mailcow). В phase2 скриптах iptables-persistent больше не используется.

**Исходящая почта (2026-07-13):** после ufw-инцидентов nft **MAILCOW isolation** в Mailcow блокировала return TCP в `br-mailcow` — Postfix не доставлял на внешние MX (timeout :25), хотя с хоста порт открыт. Исправление: `DISABLE_NETFILTER_ISOLATION_RULE=y` в `/opt/mailcow-dockerized/mailcow.conf`, flush chain MAILCOW, рестарт netfilter/unbound/postfix. Проверка: `bash scripts/prod-mailcow-outbound-check-remote.sh`. Подробнее — [Diary.md — 2026-07-13](Diary.md), [Mail-Server.md](Mail-Server.md).

**Ротация Reality VPN (103.110.64.230):** локальный чеклист `scripts/vpn-reality-rotate-local.sh` (SSH на VPN вручную); ключи **не** хранить в git — см. §14.1.

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

*Обновляйте таблицу после смены хоста, домена или способа запуска. После `git pull` на VPS полезно прогнать **раздел 9** и **`scripts/security-verify-prod.sh`** (раз в квартал).*

| Поле | Значение (актуально на 2026-07-10) |
|------|-------------------------------------|
| Дата аудита ИБ | **2026-07-10** (код + VPS hardening, см. [Diary.md](Diary.md)) |
| Версия приложения | **3.7.0** (`/api/health` → `version`) |
| SSL Let's Encrypt | `avaterra.pro` + `www`, `mail.avaterra.pro` — продлены **2026-06-15**, истекают **2026-09-13** |
| Хост VPS | p941004.kvmvps, Ubuntu 24.04 LTS, IP 95.181.224.70 |
| Активный корень приложения | /opt/ALETHEIA |
| Unit systemd | aletheia.service: `EnvironmentFile=-/opt/ALETHEIA/.env`, `DATABASE_URL=file:/opt/ALETHEIA/prisma/dev.db`, `WorkingDirectory=/opt/ALETHEIA` |
| Порт Node | **127.0.0.1:3000** (`next start -H 127.0.0.1`); nginx → proxy_pass localhost:3000 |
| ufw | **active:** 22, 80, 443, 25, 587, 993 (Mailcow); **5173 закрыт**; DOCKER-USER блокирует dev-порты Docker снаружи |
| sshd | Порт **22**, `PasswordAuthentication no`, `PubkeyAuthentication yes` (drop-in + исправлен `50-cloud-init.conf`) |
| CRON_SECRET | В `/opt/ALETHEIA/.env`; cron `/etc/cron.d/aletheia-http-cron` (рассылки / IMAP / рассрочка) |
| SCORM static | nginx `auth_request` на `/uploads/scorm/` → `/api/portal/scorm/access-check` |
| Права файлов | `.env` и `prisma/dev.db` — mode **600** |
| fail2ban | jails: **sshd**, **nginx-http-auth**, **nginx-limit-req** |
| Mailcow | /opt/mailcow-dockerized; UI nginx на **127.0.0.1:8088**; SMTP/IMAP порты публичны |
| Telegram poll worker | **`aletheia-telegram-poll.service`**; xray proxy `127.0.0.1:10809` |
| Content jobs worker | **`aletheia-jobs.service`** |
| PM2 | **Не используется** — только systemd |
| Скрипт верификации ИБ | [`scripts/security-verify-prod.sh`](../scripts/security-verify-prod.sh) (read-only) |
| Предыдущий аудит | 2026-06-15 (деплой 3.5.5) — см. историю в git / Diary |

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
| [`scripts/security-hardening-prod.sh`](../scripts/security-hardening-prod.sh) | Бэкап, ufw (22/80/443 + Mailcow 25/587/993), sshd drop-in (порт 22 + ключи), nginx HSTS, права `.env`/`dev.db`. |
| [`scripts/security-post-setup-prod.sh`](../scripts/security-post-setup-prod.sh) | HTTP cron, nginx upload locations, шифрование бэкапов `.env` (gpg), закрытие ufw 5173. |
| [`scripts/security-verify-prod.sh`](../scripts/security-verify-prod.sh) | **Read-only** аудит ИБ: sshd :22, ufw, bind 127.0.0.1:3000, CRON_SECRET, SCORM, health, права файлов. Раз в квартал. |
| [`scripts/cron-http-call.sh`](../scripts/cron-http-call.sh) | Вызов `/api/cron/*` с Bearer из `.env`. |
| [`scripts/install-aletheia-http-cron.sh`](../scripts/install-aletheia-http-cron.sh) | `/etc/cron.d/aletheia-http-cron` (рассылки / IMAP / рассрочка). |
| [`scripts/security-phase2-prod.sh`](../scripts/security-phase2-prod.sh) | Фаза 2: Next.js на 127.0.0.1, sshd без паролей, DOCKER-USER для dev-портов. **Без iptables-persistent.** |
| [`scripts/restore-ufw-prod.sh`](../scripts/restore-ufw-prod.sh) | Восстановить ufw (22/80/443 + Mailcow 25/587/993) + DOCKER-USER в `after.rules` после конфликта с iptables-persistent. |
| [`scripts/apply-nginx-scorm-auth-prod.sh`](../scripts/apply-nginx-scorm-auth-prod.sh) | nginx `auth_request` для `/uploads/scorm/` (доступ только с сессией портала). |
| [`scripts/ssh-safety-guard.sh`](../scripts/ssh-safety-guard.sh) | Guard перед reload sshd: порт 22 + PubkeyAuthentication yes. |
| [`scripts/setup-cron-secret-prod.sh`](../scripts/setup-cron-secret-prod.sh) | Одноразово: добавить `CRON_SECRET` в `.env` на VPS. |
| [`scripts/vpn-reality-rotate-local.sh`](../scripts/vpn-reality-rotate-local.sh) | Чеклист ротации Reality на VPN-сервере (вручную с SSH на 103.110.64.230). |
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
  → xray-avaterra.service (VLESS Reality proxy, порт 10809)
  → VPN сервер 103.110.64.230:443 (VLESS Reality)
  → api.telegram.org

Фоновые задачи SMM / Site Radar
  → aletheia-jobs.service → scripts/jobs-daemon.ts → lib/content/jobs/scheduler.ts
```

## 14.1 Прокси для Telegram (xray VLESS Reality)

**Проблема:** api.telegram.org заблокирован с VPS (РФ). Прямые запросы таймаутят.

**Решение:** xray VLESS Reality через VPN сервер `103.110.64.230`.

| Параметр | Значение |
|----------|----------|
| Unit | `xray-avaterra.service` (systemd) |
| Конфиг | `/usr/local/etc/xray-avaterra.json` |
| Прокси | HTTP на `127.0.0.1:10809` |
| VPN сервер | `103.110.64.230:443` |
| Протокол | VLESS Reality |
| UUID | *(см. `/usr/local/etc/xray-avaterra.json` на VPS — не хранить в git)* |
| PublicKey | *(см. конфиг xray на VPS)* |
| ShortId | *(см. конфиг xray на VPS)* |
| ServerName | `www.google.com` |
| `.env` | `HTTPS_PROXY=http://127.0.0.1:10809` |

**Стабильность:** ✅ 100% (после исправления 2026-06-29). Причина прежних сбоев: на VPN сервере работали **два xray** на порту 443 с разными ключами — старый конфиг `/usr/local/etc/xray-vless.json` конфликтовал с x-ui. После убийства старого процесса и синхронизации ключей прокси стабилен.

**Retry-логика:** `lib/telegram-fetch.ts` — 5 попыток, таймаут 25 сек, паттерны: `timeout|ECONNRESET|ECONNREFUSED|UND_ERR|abort|REALITY|fetch failed|socket hang up`.

**Команды:**
```bash
# Статус
systemctl is-active xray-avaterra
journalctl -u xray-avaterra --no-pager -n 20

# Тест прокси (5 попыток)
source /opt/ALETHEIA/.env
for i in 1 2 3 4 5; do
  curl -s --proxy http://127.0.0.1:10809 --connect-timeout 10 --max-time 20 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | grep -q '"ok":true' && echo "$i: OK" || echo "$i: FAIL"
done

# Перезапуск
systemctl restart xray-avaterra
```

**Доступ к VPN серверу:**
- SSH: `ssh -i ~/.ssh/id_ed25519 root@103.110.64.230` (ключ только на локальной машине, не в репозитории)
- x-ui панель: URL и учётные данные — в менеджере паролей / на VPN-сервере (не коммитить в git)
- WireGuard: порт 46877 (AmneziaWG); peer VPS — см. конфиг на VPN-сервере

**Известные проблемы на VPN сервере:**
- Два xray процесса на порту 443: старый (`/usr/local/etc/xray-vless.json`) и x-ui (`bin/config.json`). Если x-ui перезапускается, старый может подняться снова — убить: `pkill -f xray-vless.json`
- fail2ban может забанить IP VPS при множественных попытках подключения — разбанить: `fail2ban-client set sshd unbanip <IP>`

**Обновление ключа Reality:**
1. SSH на VPN сервер (ключ `id_ed25519`)
2. Через x-ui панель удалить/создать inbound
3. Убедиться что `/usr/local/etc/xray-vless.json` удалён или отключён
4. Обновить `publicKey` в `/usr/local/etc/xray-avaterra.json` на VPS
5. `systemctl restart xray-avaterra`

---

## 15. CI / GitHub Actions

При настройке CI: секреты `DEPLOY_HOST`, пользователь, SSH-ключ; см. комментарии в [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) и [`.github/workflows/build.yml`](../.github/workflows/build.yml).
