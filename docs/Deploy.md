# Развёртывание AVATERRA

Два варианта: **Vercel** (проще всего, репозиторий уже на GitHub) или **свой VPS** (ниже).

**Текущий продуктивный VPS (IP, systemd, nginx, сценарии деплоя):** [Production-Server.md](Production-Server.md).

**Подготовка сборки для Git и запуска на сервере (в т.ч. в режиме отладки):** см. **docs/Server-Debug.md** и скрипт `./scripts/prepare-for-server.sh`.

---

## Релиз v3.0.0 (перед первым деплоем)

**Готовность:** редизайн админки завершён (PageHeader, Card, табы, EmptyState, пагинация, форма «Добавить пользователя», каталог наборов уведомлений). См. CHANGELOG [Unreleased].

```bash
# 1. Проверить линт и сборку (одной командой)
npm run predeploy

# 2. Закоммитить изменения (если есть)
git status
git add -A && git commit -m "chore: prepare v3.0.0 release"  # при необходимости

# 3. Создать тег и отправить
git tag v3.0.0
git push origin main
git push origin v3.0.0
```

---

## Чек-лист перед деплоем

- [ ] `npm run predeploy` (или `npm run build`) проходит без ошибок
- [ ] Git тег создан и запушен (см. раздел «Релиз v3.0.0»)
- [ ] БД: Prisma миграции применены; на VPS фактический режим — по `DATABASE_URL` (SQLite или PostgreSQL, см. [Production-Server.md](Production-Server.md))
- [ ] Переменные окружения: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_URL; PayKeeper (PAYKEEPER_*); Resend (RESEND_*); DEEPSEEK_API_KEY; TELEGRAM_BOT_TOKEN (опционально, для бота). См. .env.example.
- [ ] PayKeeper: webhook URL указан в ЛК PayKeeper
- [ ] Первый админ: через seed (admin@test.local) или создать вручную в БД
- [ ] Sitemap и robots: генерируются автоматически (/sitemap.xml, /robots.txt); базовый URL из NEXT_PUBLIC_URL
- [ ] Запланированные рассылки: задать CRON_SECRET в env; вызывать GET /api/cron/mailings-send по расписанию (Vercel Cron или внешний cron) с заголовком `Authorization: Bearer <CRON_SECRET>`
- [ ] Проверка доступности: GET /api/health — возвращает 200, `{ ok: true, version, commit }` при поднятом приложении; заголовки `X-App-Version` / `X-Build-Commit` при наличии данных сборки (версия из `package.json`, короткий SHA на Vercel из `VERCEL_GIT_COMMIT_SHA`, задаётся на этапе `next build`). В подвале админки и менеджера отображается строка «Сборка …».
- [ ] Запросы браузера к `/sw.js`: в корне проекта есть минимальный `public/sw.js` (без кэширования), чтобы не засорять логи 404 — это не PWA-приложение, а заглушка под расширения/пробинг.

---

## БД для продакшена (PostgreSQL и SQLite на VPS)

Локально используется SQLite (`file:./dev.db`).

**Продуктивный VPS (avaterra.pro):** фактический режим задаётся **`DATABASE_URL`** в `.env` процесса приложения. SQLite на одном сервере (`file:./dev.db` → файл в `prisma/` по правилам Prisma) может быть **текущим рабочим** вариантом; не считать его ошибкой, пока не запланирована миграция. Проверка и единый источник правды по каталогу и БД: [Production-Server.md](Production-Server.md), скрипт [`scripts/prod-diagnostics.sh`](../scripts/prod-diagnostics.sh).

**Целевой вариант для масштабирования** (несколько инстансов, отказоустойчивость) — PostgreSQL:

1. В `prisma/schema.prisma` заменить:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. В переменных окружения задать `DATABASE_URL`, например:
   `postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public`
3. На сервере выполнить:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
4. При первом запуске (опционально): `npx prisma db seed` — тестовые пользователи (см. docs/Local-Prisma.md).

Подробнее про прод-сервер: [Production-Server.md](Production-Server.md).

---

## Вариант 1. Деплой на Vercel (рекомендуется для старта)

Сайт уже в GitHub (`github.com/denisok-ai/AVATERRA`). Чтобы выложить его в интернет за 5 минут:

### Шаги

1. Зайди на **[vercel.com](https://vercel.com)** и войди через **GitHub** (Sign in with GitHub).
2. Нажми **Add New…** → **Project**.
3. Импортируй репозиторий **AVATERRA** (если не виден — нажми **Configure** у GitHub и выдай Vercel доступ к нужным репозиториям).
4. В настройках проекта:
   - **Framework Preset:** Next.js (определится сам).
   - **Root Directory:** оставь пустым.
   - **Build Command:** `npm run build` (по умолчанию).
   - **Output Directory:** не меняй.
5. Переменные окружения: в **Settings → Environment Variables** добавь переменные из `.env.example` (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, PayKeeper, Resend, `NEXT_PUBLIC_URL`). Для продакшена укажи PostgreSQL в DATABASE_URL.
6. Нажми **Deploy**.

Через 1–2 минуты появится ссылка вида `https://avaterra-xxx.vercel.app`. Её можно открыть в браузере и прислать клиенту.

### Проверка после деплоя

- Открыть главную страницу, разделы «Оферта» и «Политика конфиденциальности».
- Проверить вход в портал (логин/пароль).
- Убедиться, что доступны `/sitemap.xml` и `/robots.txt` (генерируются автоматически).

### Свой домен на Vercel (позже)

В проекте Vercel: **Settings → Domains** → добавь домен (например `avaterra.pro`). Vercel подскажет, какие DNS-записи создать у регистратора.

### Обновление сайта

После `git push` в ветку `main` Vercel сам пересоберёт и задеплоит проект.

---

## Вариант 2. Развёртывание на арендованном сервере (VPS)

Инструкция: как выложить сайт на VPS (Linux) и открыть его по IP-адресу без домена (тестовый доступ).

### Что нужно

- Арендованный сервер (VPS) с Linux (Ubuntu/Debian) и доступ по SSH.
- IP-адрес сервера — по нему будет открываться сайт до покупки домена.

---

## Шаг 1. Собрать сайт

Проект на **Next.js**. Два варианта.

### Вариант A: Node-сервер на VPS (рекомендуется)

На компьютере только коммитим и пушим в GitHub. Сборка — на сервере:

```bash
cd ~/projects/AVATERRA
npm install
npm run build
# Артефакт в .next/ — на сервер не копируем, собираем на сервере из Git
```

На сервере после `git pull` делают `npm install && npm run build && pm2 restart avaterra` (см. ниже). Для запуска с отладчиком: `npm run start:debug` (подключение по порту 9229, см. docs/Server-Debug.md).

### Вариант B: Статический экспорт (если настроен)

Если в `next.config.mjs` указано `output: 'export'`, то после `npm run build` появится папка **`out/`** (HTML, CSS, JS, изображения). Её можно отдавать через Nginx как статику (см. шаг 2–3).

---

## Шаг 2. Перенести сайт на сервер

### Вариант A: через SCP (статический экспорт, папка `out/`)

Если используете `output: 'export'` в Next.js:

```bash
cd ~/projects/AVATERRA
npm run build
scp -r out/* root@95.181.224.70:/var/www/avaterra/
```

Папку `/var/www/avaterra/` на сервере создайте заранее (шаг 3).

### Вариант B: через Git (сборка на сервере)

На сервере по SSH:

```bash
ssh root@95.181.224.70

sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/denisok-ai/ALETHEIA.git
cd ALETHEIA
sudo npm install
sudo npm run build
# Дальше — запуск через Node (pm2) или настройка Nginx на прокси к Next (шаг 3)
```

---

## Шаг 3. Установить Nginx и отдать папку с сайтом

Подключитесь к серверу по SSH и выполните команды по порядку.

### 3.1 Установка Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 3.2 Папка с сайтом

- Если переносили через **SCP** (статический экспорт): папка `/var/www/avaterra/` с содержимым `out/` (index.html, _next/, images/ и т.д.).
- Если через **Git** и Node: Nginx проксирует запросы на Next.js (порт 3000), см. ниже.

Создайте папку (если используете SCP и ещё не создали):

```bash
sudo mkdir -p /var/www/avaterra
# После копирования с вашего ПК сюда должны лежать index.html, assets/, images/
```

### 3.3 Конфиг Nginx для теста по IP

Создайте конфиг:

```bash
sudo nano /etc/nginx/sites-available/avaterra
```

Вставьте (замените `ВАШ_IP` на IP сервера, напр. `95.181.224.70`, или оставьте `_` — тогда будет слушать все адреса):

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root /var/www/AVATERRA/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

Если сайт лежит в `/var/www/avaterra/` (без подпапки dist), замените строку `root` на:

```nginx
root /var/www/avaterra;
```

Сохраните файл (в nano: Ctrl+O, Enter, Ctrl+X).

### 3.4 Включить сайт и перезапустить Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/avaterra /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 3.5 Открыть порт 80 в файрволе

```bash
sudo ufw allow 80/tcp
sudo ufw status
sudo ufw enable
```

При запросе подтверждения нажмите `y`.

---

## Шаг 4. Тестовый адрес без домена

Домена пока нет — сайт открывается по **IP-адресу сервера**, например прод AVATERRA:

```
http://95.181.224.70
```

Сейчас основной вход — с доменом: https://avaterra.pro.

---

## Удобный тестовый адрес с «именем» (опционально)

Если хочется адрес вида `avaterra.95.181.224.70.sslip.io` (читается проще, чем голый IP), можно использовать бесплатный сервис **sslip.io** (или **nip.io**):

- Подставьте свой IP вместо `IP`:
  - `http://IP.sslip.io` — открывает ваш сервер по IP.
  - `http://avaterra.IP.sslip.io` — тоже ведёт на тот же IP (Nginx отдаёт тот же сайт, т.к. `server_name _`).

Пример для IP `95.181.224.70`:

```
http://95.181.224.70.sslip.io
http://avaterra.95.181.224.70.sslip.io
```

Регистрация не нужна: sslip.io и nip.io по имени сразу отдают ваш IP.

---

## Проверка (тест)

1. На сервере: `curl -I http://127.0.0.1` — должен вернуться ответ с `200 OK` или `304`.
2. С вашего компьютера или телефона откройте в браузере: `http://95.181.224.70` или https://avaterra.pro.
3. Должна открыться главная страница AVATERRA; проверьте разделы и картинки.

---

## Когда появится домен

1. В панели регистратора домена укажите A-запись: ваш домен → IP сервера.
2. В конфиге Nginx замените `server_name _;` на `server_name yourdomain.ru www.yourdomain.ru;`.
3. Выполните: `sudo nginx -t && sudo systemctl reload nginx`.
4. (Опционально) Поставьте SSL (Let's Encrypt): `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d yourdomain.ru -d www.yourdomain.ru`.

---

## Краткий чек-лист

- [ ] Локально: код в GitHub, на сервере — клонирован или обновлён через `git pull`.
- [ ] На сервере: `npm install && npm run build` (или скопирована папка `out/` при статике).
- [ ] Установлен Nginx (и при необходимости PM2 для Next.js), конфиг с `root` или proxy.
- [ ] Конфиг включён в `sites-enabled`, `nginx -t`, `systemctl reload nginx`.
- [ ] Порт 80 открыт в ufw.
- [ ] Сайт открывается по https://avaterra.pro или `http://95.181.224.70`.

---

## Как обновить сборку на сервере

После правок в коде вы пушите в GitHub. Чтобы подтянуть изменения на сервер и пересобрать сайт:

### 1. Подключиться к серверу по SSH

```bash
ssh root@95.181.224.70
```

### 2. Перейти в каталог приложения и обновить (прод AVATERRA)

Рекомендуется один скрипт вместо ручных шагов:

```bash
cd /opt/ALETHEIA
sudo bash scripts/deploy-pull.sh
```

Вручную (эквивалент по смыслу):

```bash
cd /opt/ALETHEIA
sudo git pull origin main
sudo npm ci 2>/dev/null || sudo npm install
npx prisma generate
npx prisma migrate deploy
sudo npm run build
sudo systemctl restart aletheia.service
```

### 3. Перезапустить приложение (если делали только `git pull` + `build` без скрипта)

- **systemd (текущий прод):** `sudo systemctl restart aletheia.service`
- **PM2 (если используете):** `sudo pm2 restart aletheia` — см. `pm2 list`
- **Статика из `out/`:** после `npm run build` файлы в `out/`; перезапуск Node не нужен, если Nginx отдаёт только статику.

Готово. Проверьте сайт в браузере по IP или домену.

---

## Скрипты деплоя на сервере

В папке `scripts/` есть скрипты для автоматизации обновления на сервере.

**Продуктивный VPS:** `95.181.224.70`, каталог **`/opt/ALETHEIA`**, домен https://avaterra.pro. Подробные команды — в [Production-Server.md](Production-Server.md).

### Выгрузка с гита (pull + build + restart)

На сервере (после `ssh root@95.181.224.70`):

```bash
cd /opt/ALETHEIA
sudo bash scripts/deploy-pull.sh
```

Скрипт выполняет: `git pull` → `npm install` / `npm ci` → `prisma generate` → `prisma migrate deploy` → `npm run build` → рестарт `aletheia.service` (или PM2) → при наличии прав — сброс proxy-кеша nginx.

### Деплой без git на сервере (rsync с WSL)

Сборка локально, на `95.181.224.70` уезжают артефакты (см. `scripts/deploy-rsync-from-local.sh`):

```bash
cd ~/projects/ALETHEIA
npm run deploy:rsync
```

По умолчанию цель — `root@95.181.224.70:/opt/ALETHEIA`. Переопределение: `export DEPLOY_SSH=...`.

Переменные окружения (опционально):
- `DEPLOY_ROOT` — путь к проекту (по умолчанию `/opt/ALETHEIA`)
- `PM2_NAME` — имя процесса PM2 (по умолчанию `aletheia`)
- `GIT_BRANCH` — ветка для pull (по умолчанию `main`)
- **`RESET_AND_SEED=1`** — на тестовом сервере: полный сброс БД (`prisma migrate reset --force`), затем автоматически выполняется **`prisma/seed.ts`**. Все данные в БД удаляются. На продакшене **не использовать**.

**Депой с тестовыми данными** (после SSH на сервер, из каталога приложения):

```bash
cd /opt/ALETHEIA
RESET_AND_SEED=1 bash scripts/deploy-pull.sh
```

Перед этим убедитесь, что нужный коммит уже в `origin` (`git push` с рабочей машины). Пароли root и SSH **никогда не передавайте в чатах** — используйте SSH-ключи; скомпрометированный пароль смените на сервере.

### Загрузка на гит (push с сервера)

Если на сервере внесены изменения и нужно отправить их в репозиторий:

```bash
cd /opt/ALETHEIA
bash scripts/deploy-push.sh "Описание изменений"
```

Скрипт выполняет: `git add -A` → `git commit` → `git push origin main`.
