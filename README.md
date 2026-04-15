# AVATERRA — Phygital школа мышечного тестирования

Современный лендинг на Next.js 14 с 3D-эффектами, анимациями и интеграцией PayKeeper.  
Домен: [avaterra.pro](https://avaterra.pro).

## Стек

- **Next.js 14** (App Router), TypeScript
- **Tailwind CSS**, Framer Motion, React Three Fiber (3D-частицы в Hero)
- **PayKeeper** — приём платежей
- **Prisma + SQLite** — локальная БД (портал, курсы, заявки)
- **NextAuth** — аутентификация (Credentials)
- **Resend**, **Telegram** — уведомления
- Деплой: **Vercel** или VPS — [docs/Deploy.md](docs/Deploy.md). Продуктив avaterra.pro: [docs/Production-Server.md](docs/Production-Server.md), диагностика `bash scripts/prod-diagnostics.sh`. [docs/Server-Setup.md](docs/Server-Setup.md) — устаревший сценарий `/var/www` + PM2.

## Портал (v3.0)

- **Роли:** user (студент), manager, admin
- **ЛК студента:** дашборд, курсы (SCORM), сертификаты, медиатека, уведомления, поддержка
- **Админка:** пользователи (добавление, роли), курсы (SCORM), сертификаты, медиа, оплаты, CRM, коммуникации, наборы уведомлений, AI-настройки, аудит, настройки
- **Менеджер:** тикеты, поиск пользователей, верификация заданий

Вход: `/login`, регистрация: `/register`. Тестовые аккаунты — см. `docs/Local-Prisma.md`.

## Как запустить

Требуется [Node.js](https://nodejs.org/) 18+.

```bash
cd /home/denisok/projects/ALETHEIA
npm install
npm run db:migrate
npm run db:seed
cp .env.example .env.local   # добавьте NEXTAUTH_SECRET
npm run dev
```

Откройте в браузере: **http://localhost:3000**.

**Одна команда (seed + dev с отладкой):** `npm run dev:debug:seed`. Если приложение не стартует — см. раздел «Если приложение не стартует» в **docs/Local-Prisma.md**.

## Сборка для продакшена

```bash
npm run build
npm run start
```

Или загрузите проект на Vercel — сборка настроена автоматически.

## Переменные окружения

Скопируйте `.env.example` в `.env.local` и заполните:

- **БД:** `DATABASE_URL="file:./dev.db"` — для SQLite (локально)
- **NextAuth:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL` — обязательны для портала
- **PayKeeper:** `PAYKEEPER_SERVER`, `PAYKEEPER_LOGIN`, `PAYKEEPER_PASSWORD`, `PAYKEEPER_SECRET` — для приёма оплаты
- **App:** `NEXT_PUBLIC_URL` — полный URL сайта (для писем и ссылок)

## Структура проекта

- `app/` — страницы (layout, главная, success, oferta, privacy), auth (login, register, reset-password), portal (student, admin, manager), API; sitemap.xml и robots.txt генерируются автоматически
- `components/sections/` — Hero, About, Program, Author, Testimonials, Pricing, FAQ, Contact, Header, Footer
- `components/ui/` — кнопки, поля ввода, диалоги
- `components/3d/` — 3D-фон с частицами в Hero
- `lib/` — paykeeper, auth, db, utils
- `prisma/` — схема БД, seed
- `public/images/` — изображения: `tatiana/`, `thematic/`, `hero/`, `author/`, `icons/`, `pricing/`, `decor/`, `success/`
- `docs/` — Project.md, Content.md, Media.md, Local-Prisma.md, Tasktracker.md, Diary.md, qa.md

## Платежи (PayKeeper)

1. Настройте учётную запись PayKeeper и получите доступ к API.
2. В личном кабинете PayKeeper укажите URL webhook: `https://ваш-домен/api/webhook/paykeeper`.
3. После оплаты пользователь может быть перенаправлен на `/success` (настраивается в PayKeeper).

## Документация

- **docs/Project.md** — цели, архитектура
- **docs/Local-Prisma.md** — локальный запуск (Prisma + SQLite)
- **docs/Production-Server.md** — состояние продуктивного сервера (IP, NGINX, SSL, PM2)
- **docs/Support.md** — структура, частые задачи
- **docs/Deploy.md** — Vercel, VPS
