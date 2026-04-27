# Локальный запуск (Prisma + SQLite)

Полностью локальная разработка без Supabase и Docker. БД — SQLite в `prisma/dev.db`.

---

## Если приложение не стартует

1. **Каталог и команды** — выполняйте команды из корня проекта. Одна команда в одну строку:
   ```bash
   cd /home/denisok/projects/ALETHEIA
   npm run dev
   ```
   Не склеивайте несколько команд в одну строку без `&&`.

2. **База данных** — при первом запуске нужны миграции и (при необходимости) seed:
   ```bash
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

3. **Переменные окружения** — скопируйте `.env.example` в `.env.local` и задайте минимум:
   `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Без них Next.js или авторизация могут не работать.

4. **Порт 3000 занят** — остановите другой процесс на 3000 или запустите с другим портом:
   `npm run dev -- -p 3001`.

5. **Режим отладки** — для запуска с инспектором Node используйте:
   `npm run dev:debug` или `npm run dev:debug:seed` (сначала seed, затем dev с отладкой).

---

## Перезапуск после доработок (кратко)

Если вы уже настраивали проект и только что внесли изменения в код:

1. **Остановите** dev-сервер (в терминале, где запущен `npm run dev`: `Ctrl+C`).
2. Запустите снова:
   ```bash
   npm run dev
   ```
3. Откройте в браузере: **http://localhost:3000**.

Если меняли **схему Prisma** (`prisma/schema.prisma`) — перед `npm run dev` выполните:
   ```bash
   npm run db:migrate
   ```
Если меняли только **зависимости** (`package.json`) — один раз:
   ```bash
   npm install
   npm run dev
   ```

Подробная первичная настройка — ниже.

---

## Шаг 1. Установка

```bash
cd /home/denisok/projects/ALETHEIA
npm install
```

---

## Шаг 2. База данных

```bash
# Миграции (создаёт prisma/dev.db)
npm run db:migrate

# Минимальные данные (admin, manager, курс, тарифы; пароль SEED_ADMIN_PASSWORD или AvaterraSetup123!)
npm run db:seed

# Опционально: Prisma Studio для просмотра БД
npm run db:studio
```

Если в таблице верификаций остались старые тестовые URL вида `/portal/manager/verifications#video-…` (до правок seed), можно однократно заменить их на путь-заглушку для видео-заявок:

```bash
npm run db:fix-verification-urls
```

Скрипт: `scripts/fix-verification-material-urls.ts`. При необходимости положите в `public/uploads/verifications/` файл-заглушку для видео.

---

## Шаг 3. Переменные окружения

```bash
cp .env.example .env.local
```

Минимально нужны:

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET=любая_случайная_строка_32_символа
NEXTAUTH_URL=http://localhost:3000
```

Для чат-бота и уведомлений — DEEPSEEK_API_KEY, RESEND_* (см. .env.example).

---

## Шаг 4. Запуск

```bash
npm run dev
```

Откройте http://localhost:3000

**Учётные записи после `db:seed` (пароль задаётся `SEED_ADMIN_PASSWORD`, по умолчанию `AvaterraSetup123!`):**
| Email | Роль | Назначение |
|-------|------|------------|
| admin@avaterra.local | Админ | Полный доступ к порталу (см. `SEED_ADMIN_EMAIL`) |
| manager@avaterra.local | Менеджер | Тикеты, верификации (см. `SEED_MANAGER_EMAIL`) |

Студента для ЛК нужно создать регистрацией или вручную в админке — массовые тестовые студенты убраны из сида.

---

## Режим отладки и проверка функционала

**Запуск в режиме отладки (инспектор Node.js):**
```bash
npm run dev:debug
```
Сервер поднимется с открытым портом для отладчика (обычно `ws://127.0.0.1:9229`). В Chrome: `chrome://inspect` → Open dedicated DevTools for Node.

**Перезапуск с тестовыми данными и отладкой (одной командой):**
```bash
npm run dev:debug:seed
```
Либо по шагам (остановите dev через Ctrl+C перед этим):
```bash
cd /home/denisok/projects/ALETHEIA
npm run db:seed
npm run dev
```
Или с отладкой:
```bash
npm run db:seed
npm run dev:debug
```

**Чек-лист проверки после seed:**
1. **Сайт:** http://localhost:3000 — лендинг, тарифы.
2. **Вход:** http://localhost:3000/login — `admin@avaterra.local` (или `SEED_ADMIN_EMAIL`) с паролем из сида.
3. **Админка:** `/portal/admin/dashboard`, курсы, пользователи, оплаты — без ошибок.
4. **Студент:** зарегистрируйте тестового пользователя или создайте в админке — сид не создаёт 50 студентов.

---

## Файлы и хранилище

- **SCORM:** загрузка в `public/uploads/scorm/`
- **Медиа:** загрузка в `public/uploads/media/`
- Папки создаются автоматически при первой загрузке.

---

## Продакшен

Для production смените в `prisma/schema.prisma`:

```
provider = "postgresql"
url      = env("DATABASE_URL")
```

И укажите `DATABASE_URL` на PostgreSQL.
