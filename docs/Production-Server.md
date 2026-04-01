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

Один «источник правды» для кода и `.next` на машине — **только** `/opt/ALETHEIA`. Второй клон в `/var/www/...` с параллельным процессом на том же порту приводит к 502 и «старой» админке.

---

## 2. Процесс приложения (Node / Next.js)

- **Рекомендуемый запуск:** **systemd** — unit `aletheia.service`.
- **Пример unit:** [`scripts/systemd/aletheia.service.example`](../scripts/systemd/aletheia.service.example) — поля **`WorkingDirectory=/opt/ALETHEIA`** и `ExecStart=npm run start` должны указывать на **тот же** каталог, где выполняли `npm run build`.
- **Порт upstream для nginx:** по умолчанию **3000** (переопределяется `PORT` в `.env` — тогда в nginx `proxy_pass` должен совпадать).
- **`NODE_ENV`:** `production` (в unit или окружении).
- **Секреты и URL:** файл **`.env`** в `/opt/ALETHEIA` (в git не коммитится). Список переменных — [.env.example](../.env.example), подробнее — [Env-Config.md](Env-Config.md).
- **Рекомендуется в `.env` на проде:** `NEXTAUTH_URL=https://avaterra.pro` (иначе предупреждение next-auth в логах).
- **SQLite на этом VPS:** в `.env` задать `DATABASE_URL="file:/opt/ALETHEIA/prisma/dev.db"` (см. §5).
- **Опционально:** `npm install sharp` в каталоге приложения — ускорение оптимизации изображений Next.js.

**PM2:** если ранее использовался, на проде должен остаться **либо** PM2, **либо** systemd, но не оба на порту 3000. При переходе на systemd: `pm2 delete aletheia`, `pm2 save`.

---

## 3. Nginx

- **Конфиг сайта:** `/etc/nginx/sites-available/aletheia` → симлинк `sites-enabled/aletheia`.
- **Схема:** HTTPS (443) и/или HTTP → `proxy_pass http://127.0.0.1:3000` (или другой порт из `.env`).
- **Кеш `proxy_cache`:** если для `location /` включены `proxy_cache` и длинный `proxy_cache_valid 200`, nginx может отдавать **устаревший HTML/RSC** после деплоя. Рекомендация: для динамики не кешировать ответы приложения (`proxy_no_cache` / отдельный `location` только для `/_next/static/`). Пример без кеша HTML — [`scripts/nginx-aletheia.conf`](../scripts/nginx-aletheia.conf).
- **После правок:** `sudo nginx -t && sudo systemctl reload nginx`.

---

## 4. SSL и доверие к CA

- **Let's Encrypt** для `avaterra.pro` / `www` (certbot + nginx).
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
| **Деплой без git** | С ПК (WSL): **`npm run deploy:rsync`** → [`scripts/deploy-rsync-from-local.sh`](../scripts/deploy-rsync-from-local.sh) (по умолчанию `root@95.181.224.70:/opt/ALETHEIA`). **Не запускать** `deploy:rsync` на самом VPS. |

---

## 7. Порядок обновления продакшена

### Вариант A — через Git (основной)

1. На **рабочей машине:** закоммитить и отправить изменения:  
   `git push origin main`.
2. По SSH на сервер:  
   `ssh root@95.181.224.70`
3. Выполнить:  
   `cd /opt/ALETHEIA && sudo bash scripts/deploy-pull.sh`

Скрипт: `git pull` → зависимости → `prisma generate` → `prisma migrate deploy` → удаление `.next` → `npm run build` → рестарт `aletheia.service` (или PM2) → при возможности сброс proxy-кеша nginx.

**Переменные (опционально):** `DEPLOY_ROOT`, `GIT_BRANCH`, `SKIP_NGINX_CACHE=1`, `APP_PORT` — см. комментарии в [`scripts/deploy-pull.sh`](../scripts/deploy-pull.sh).  
**С ПК:** [`scripts/deploy-remote.sh`](../scripts/deploy-remote.sh) (`npm run deploy:remote`) передаёт на сервер `SKIP_NGINX_CACHE`; шаг **5b** в `deploy-pull.sh` очищает `proxy_cache` (см. [`scripts/nginx-clear-proxy-cache.sh`](../scripts/nginx-clear-proxy-cache.sh)) и делает `nginx reload`. Если каталога кеша нет — скрипт не падает, при необходимости всё равно выполняется reload.  
**На тестовом стенде** (не на проде с реальными данными): `RESET_AND_SEED=1` — полный сброс БД и seed.

### Вариант B — без `git pull` на сервере (rsync с WSL)

1. На **ПК в WSL**, в корне репозитория:  
   `cd ~/projects/ALETHEIA`
2. При необходимости:  
   `export DEPLOY_SSH_IDENTITY="$HOME/.ssh/ваш_ключ"`
3. Запуск:  
   `npm run deploy:rsync`

Локально выполняется `next build`, на сервер синхронизируются `.next/`, `public/`, `prisma/` (без локальных `.db`), `package.json`, lockfile, `next.config.mjs`, `middleware.ts`; на сервере — `npm ci`, `prisma generate`, очистка кеша nginx (если есть), старт сервиса. Файл **`.env` на сервере не перезаписывается**.

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

| Поле | Значение (актуально на 2026-04-01) |
|------|-------------------------------------|
| Дата аудита | 2026-04-01 |
| Хост VPS | `p941004.kvmvps`, Ubuntu 24.04 LTS, IP `95.181.224.70` |
| Активный корень приложения | `/opt/ALETHEIA` |
| Unit systemd | `aletheia.service`, `WorkingDirectory=/opt/ALETHEIA` |
| Порт Node | `3000` (nginx → `127.0.0.1:3000`) |
| Тип БД | SQLite, файл `/opt/ALETHEIA/prisma/dev.db`; в `.env`: `DATABASE_URL="file:/opt/ALETHEIA/prisma/dev.db"` |
| Файл nginx vhost | `/etc/nginx/sites-enabled/aletheia` |
| Второй клон приложения | Нет: под `/var/www` только `html`, отдельного клона ALETHEIA нет |
| PM2 | Запись `aletheia` в состоянии stopped; рабочий процесс — только systemd |
| Примечание | Витрина `/api/shop/products` приведена к трём тарифам (`kod-tela-start`, `avaterra-praktik`, `avaterra-master-vip`); после правок БД и смены `DATABASE_URL` выполнялись `next build` + `systemctl restart aletheia`; `commit` в `/api/health` совпадает с деплоем (например `9cfcfe0`). |

---

## 13. Скрипты (справочник)

| Файл | Назначение |
|------|------------|
| [`scripts/prod-diagnostics.sh`](../scripts/prod-diagnostics.sh) | Расширенная диагностика VPS (read-only), §9. |
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
  → https://avaterra.pro:443 (nginx + TLS)
  → http://127.0.0.1:3000 (Next.js, systemd aletheia.service)
```

---

## 15. CI / GitHub Actions

При настройке CI: секреты `DEPLOY_HOST`, пользователь, SSH-ключ; см. комментарии в [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) и [`.github/workflows/build.yml`](../.github/workflows/build.yml).
