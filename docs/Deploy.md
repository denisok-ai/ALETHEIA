# Развёртывание AVATERRA

Два варианта: **Vercel** (проще всего, репозиторий уже на GitHub) или **свой VPS** (ниже).

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
- [ ] БД: Prisma миграции применены, для прода — PostgreSQL (сменить provider в schema.prisma)
- [ ] Переменные окружения: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_URL; PayKeeper (PAYKEEPER_*); Resend (RESEND_*); DEEPSEEK_API_KEY; TELEGRAM_BOT_TOKEN (опционально, для бота). См. .env.example.
- [ ] PayKeeper: webhook URL указан в ЛК PayKeeper
- [ ] Первый админ: через seed (admin@test.local) или создать вручную в БД
- [ ] Sitemap и robots: генерируются автоматически (/sitemap.xml, /robots.txt); базовый URL из NEXT_PUBLIC_URL
- [ ] Запланированные рассылки: задать CRON_SECRET в env; вызывать GET /api/cron/mailings-send по расписанию (Vercel Cron или внешний cron) с заголовком `Authorization: Bearer <CRON_SECRET>`
- [ ] Проверка доступности: GET /api/health — возвращает 200 и `{ ok: true }` при поднятом приложении (для мониторинга и балансировщиков)

---

## БД для продакшена (PostgreSQL)

Локально используется SQLite (`file:./dev.db`). На проде нужен PostgreSQL.

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

Подробнее про прод-сервер: `docs/Production-Server.md`.

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
scp -r out/* root@IP_СЕРВЕРА:/var/www/avaterra/
```

Папку `/var/www/avaterra/` на сервере создайте заранее (шаг 3).

### Вариант B: через Git (сборка на сервере)

На сервере по SSH:

```bash
ssh root@IP_СЕРВЕРА

sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/ВАШ_ЛОГИН/AVATERRA.git
cd AVATERRA
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

Вставьте (замените `ВАШ_IP` на реальный IP сервера или оставьте `_` — тогда будет слушать все адреса):

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

Домена пока нет — сайт открывается по **IP-адресу сервера**:

```
http://IP_СЕРВЕРА
```

Пример: если IP сервера `185.100.50.25`, в браузере вводите:

```
http://185.100.50.25
```

Это и есть бесплатный тестовый адрес: платить за домен не нужно, пока вы тестируете по IP.

---

## Удобный тестовый адрес с «именем» (опционально)

Если хочется адрес вида `avaterra.185.100.50.25.sslip.io` (читается проще, чем голый IP), можно использовать бесплатный сервис **sslip.io** (или **nip.io**):

- Подставьте свой IP вместо `IP`:
  - `http://IP.sslip.io` — открывает ваш сервер по IP.
  - `http://avaterra.IP.sslip.io` — тоже ведёт на тот же IP (Nginx отдаёт тот же сайт, т.к. `server_name _`).

Пример для IP `185.100.50.25`:

```
http://185.100.50.25.sslip.io
http://avaterra.185.100.50.25.sslip.io
```

Регистрация не нужна: sslip.io и nip.io по имени сразу отдают ваш IP.

---

## Проверка (тест)

1. На сервере: `curl -I http://127.0.0.1` — должен вернуться ответ с `200 OK` или `304`.
2. С вашего компьютера или телефона откройте в браузере: `http://IP_СЕРВЕРА`.
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
- [ ] Сайт открывается по `http://IP_СЕРВЕРА`.

---

## Как обновить сборку на сервере

После правок в коде вы пушите в GitHub. Чтобы подтянуть изменения на сервер и пересобрать сайт:

### 1. Подключиться к серверу по SSH

```bash
ssh root@IP_СЕРВЕРА
# или ssh ubuntu@IP_СЕРВЕРА
```

### 2. Перейти в папку проекта и подтянуть код

```bash
cd /var/www/AVATERRA
sudo git pull origin main
```

(Если ветка называется `master`, замените на `git pull origin master`.)

### 3. Установить зависимости (если изменился package.json) и собрать

```bash
sudo npm install
sudo npm run build
```

### 4. Перезапустить приложение

- **Если Next.js запущен через PM2:**

  ```bash
  sudo pm2 restart avaterra
  # или как назвали процесс: pm2 list
  ```

- **Если отдаёте статику из папки `out/`:** после `npm run build` новые файлы уже в `out/`, Nginx отдаёт их автоматически — перезапуск не нужен.

- **Если Next.js запущен через systemd:**  
  `sudo systemctl restart avaterra` (или как назван ваш сервис).

Готово. Проверьте сайт в браузере по IP или домену.
