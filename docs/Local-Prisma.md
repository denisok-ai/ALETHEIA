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

# Тестовые данные (admin, manager, student — пароль Test123!)
npm run db:seed

# Опционально: Prisma Studio для просмотра БД
npm run db:studio
```

Если в таблице верификаций остались старые тестовые URL вида `/portal/manager/verifications#video-…` (до правок seed), можно однократно заменить их на путь-заглушку для видео-заявок:

```bash
npm run db:fix-verification-urls
```

Скрипт: `scripts/fix-verification-material-urls.ts`. Убедитесь, что в `public/uploads/verifications/` есть файл `seed-verification-placeholder.mp4` (его создаёт `npm run db:seed`).

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

**Тестовые аккаунты (пароль у всех: `Test123!`):**
| Email | Роль | Назначение |
|-------|------|------------|
| admin@test.local | Админ | Полный доступ: курсы, пользователи, CRM, оплаты, коммуникации, аудит |
| manager@test.local | Менеджер | Тикеты, верификации, поиск пользователей |
| student@test.local | Студент | Дашборд, 2 курса, прогресс, сертификат, тикет, уведомления |
| student2@test.local | Студент | Один курс, для проверки записей и списков |

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
1. **Сайт:** http://localhost:3000 — лендинг, тарифы, форма контакта.
2. **Вход:** http://localhost:3000/login — войти как admin@test.local / Test123!
3. **Админка:** http://localhost:3000/portal/admin/dashboard — метрики (пользователи, курсы, выручка, лиды).
4. **Курсы:** Список курсов (2 курса), записанные пользователи, запись пользователя на курс, просмотр SCORM.
5. **Пользователи:** Список (4 пользователя), карточка студента — записи на курсы, сертификат, тикет, кнопка «Записать на курс».
6. **Оплаты:** Заказы ORD-TEST-001 (оплачен), ORD-TEST-002 (ожидает), ручное подтверждение.
7. **CRM:** 3 лида, смена статуса, конвертация.
8. **Коммуникации:** Шаблон «Приветствие», история отправок, кнопка «Обновить».
9. **Сертификаты:** Один сертификат у student, массовая выдача.
10. **Выход, вход как student@test.local:** Дашборд (XP, курсы), «Мои курсы» (2 курса), сертификаты, уведомления (2), поддержка (1 тикет).
11. **Вход как manager@test.local:** Тикеты, верификации (если есть записи).

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
