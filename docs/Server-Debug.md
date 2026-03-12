# Подготовка сборки для Git и запуска на сервере в режиме отладки

Краткая инструкция: как подготовить проект к коммиту, переносу на сервер и запуску с возможностью подключения отладчика.

---

## 1. Подготовка к коммиту и сборке

### Локально (перед push)

```bash
# Проверка и сборка одной командой
npm run predeploy
# или по шагам:
npm run lint
npm run build
```

Скрипт **prepare-for-server** выполняет линт и сборку и выводит подсказки по следующим шагам:

```bash
./scripts/prepare-for-server.sh
```

### Что не коммитить

Убедитесь, что в репозитории нет:

- `.env`, `.env.local`, `.env.production.local` (уже в `.gitignore`)
- `node_modules/`, `.next/`, `public/uploads/`
- Секреты и ключи — только в переменных окружения на сервере или в панели деплоя

---

## 2. Перенос на сервер через Git

### На своей машине

```bash
git add -A
git status
git commit -m "описание изменений"
git push origin main
```

### На сервере (первый раз или обновление)

```bash
cd /opt/ALETHEIA   # или ваш путь к проекту

# Обновить код
git pull origin main

# Зависимости (для сборки нужны и devDependencies)
npm ci
# или: npm install

# Prisma
npx prisma generate
npx prisma migrate deploy   # если есть новые миграции

# Сборка (при нехватке памяти использовать build:server)
npm run build
# или: npm run build:server
```

---

## 3. Запуск на сервере

### Обычный режим (production)

```bash
npm run start
```

Через PM2 (рекомендуется для постоянной работы):

```bash
pm2 start npm --name aletheia -- start
pm2 save
pm2 startup   # при первом разе
```

### Режим отладки (inspect)

Чтобы подключить отладчик (Chrome DevTools, VS Code и т.п.) к процессу на сервере:

```bash
# Запуск с открытым портом для инспектора (по умолчанию 9229)
npm run start:debug
```

Через PM2 (для отладки без постоянного терминала):

```bash
pm2 start npm --name aletheia-debug -- run start:debug
```

Важно:

- Отладчик слушает порт **9229** (или следующий свободный). На сервере с файрволом этот порт нужно либо открыть только для вашего IP, либо использовать SSH-туннель.
- Для продакшена не оставляйте долго работающий процесс с `--inspect` без ограничения доступа к порту 9229.

#### Подключение отладчика с локальной машины

Через SSH-туннель (без открытия порта 9229 в интернет):

```bash
ssh -L 9229:127.0.0.1:9229 user@IP_СЕРВЕРА
```

На своей машине откройте Chrome: `chrome://inspect` → **Configure** → добавьте `localhost:9229`. Появится удалённый target, к нему можно подключиться.

В VS Code: в **Run and Debug** создайте конфигурацию типа **Node.js: Attach to Process** с `port: 9229` и `address: localhost` (при использовании туннеля выше).

---

## 4. Переменные окружения на сервере

Создайте на сервере файл `.env` (или задайте переменные в systemd/PM2) по образцу `.env.example`:

- `DATABASE_URL` — для прода лучше PostgreSQL
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (например `https://avaterra.pro`)
- `NEXT_PUBLIC_URL` — публичный URL сайта
- При необходимости: PayKeeper, Resend, DeepSeek, Telegram, `CRON_SECRET`

Файл `.env` не должен попадать в Git.

---

## 5. Краткий чек-лист

| Шаг | Действие |
|-----|----------|
| 1 | Локально: `npm run predeploy` или `./scripts/prepare-for-server.sh` |
| 2 | `git add`, `commit`, `push` |
| 3 | На сервере: `git pull`, `npm ci`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run build` |
| 4 | Запуск: `npm run start` или через PM2 |
| 5 | Для отладки: `npm run start:debug` и подключение по порту 9229 (лучше через SSH-туннель) |

Подробнее про деплой и Nginx: **docs/Deploy.md**, про текущий прод-сервер: **docs/Production-Server.md**.

---

## Устранение неполадок на сервере

### Ошибки: «Could not find Prisma Schema», «vite build», «aletheia@0.1.0»

Если при выполнении шагов выше появляются:

- `Could not find Prisma Schema` (нет `prisma/schema.prisma`);
- `npm run build` запускает **vite build** вместо **next build**;
- в `package.json` указано имя `aletheia` и скрипт `vite build`,

значит в каталоге на сервере (например `/opt/ALETHEIA`) лежит **другой проект**, а не этот (Next.js + Prisma, имя `avaterra-course`, сборка `next build`).

**Что сделать:**

1. **Проверить содержимое на сервере:**
   ```bash
   cd /opt/ALETHEIA
   cat package.json | grep -E '"name"|"build"'
   ls -la prisma/
   ```
   Должно быть: `"name": "avaterra-course"`, в scripts — `"build": "next build"`, каталог `prisma/` с файлом `schema.prisma`.

2. **Вариант А — переключить на правильный репозиторий и подтянуть код:**
   ```bash
   cd /opt/ALETHEIA
   git remote -v
   # Если remote ведёт не в ваш репозиторий с AVATERRA (Next.js + Prisma), поменять:
   # git remote set-url origin https://github.com/ВАШ_ЛОГИН/AVATERRA.git
   git fetch origin
   git checkout main
   git reset --hard origin/main
   git pull origin main
   ls prisma/schema.prisma   # должен существовать
   ```

3. **Вариант Б — развернуть проект заново в новую папку:**
   ```bash
   cd /opt
   sudo mv ALETHEIA ALETHEIA.old
   sudo git clone https://github.com/ВАШ_ЛОГИН/AVATERRA.git ALETHEIA
   cd ALETHEIA
   ```
   Дальше выполнить шаги из раздела «На сервере» выше (переменные окружения скопировать из старой папки или создать заново).

4. **Убедиться, что на GitHub есть папка `prisma/`.** Если на сервере после `git pull` нет `prisma/schema.prisma`, значит коммиты с Prisma не запушены. **На своей машине** (где есть полный проект):
   ```bash
   git status
   git push origin main
   ```
   Затем на сервере снова: `git pull origin main`, проверить `ls prisma/schema.prisma`.

5. **Создать на сервере файл `.env`** (без него `prisma migrate deploy` выдаст «Environment variable not found: DATABASE_URL»). Минимум:
   ```bash
   cd /opt/ALETHEIA
   cp .env.example .env
   nano .env   # задать DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_URL
   ```
   Для быстрого старта с SQLite: `DATABASE_URL="file:./dev.db"` (БД будет в `prisma/dev.db`). Для прода лучше PostgreSQL — см. docs/Deploy.md.

6. **После того как в каталоге есть `prisma/schema.prisma` и `.env`:**
   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   npm run start
   ```
   Для сборки нужны все зависимости (в т.ч. dev), поэтому используется `npm ci` без `--omit=dev`.
