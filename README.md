# AVATERRA — Phygital-школа мышечного тестирования

Сайт школы «Аватэрра» ([avaterra.pro](https://avaterra.pro)): лендинг, блог и глоссарий, портал (студент, менеджер,
админ), SCORM-плеер курсов, платежи PayKeeper, почта Mailcow, Telegram-бот.

## Стек

- **Next.js 16** (App Router, сборка webpack), **React 19**, TypeScript
- **Tailwind CSS**, Framer Motion
- **Prisma 6 + SQLite** — БД портала, курсов, заявок, CRM
- **NextAuth 4** — аутентификация (Credentials)
- **PayKeeper** — приём платежей; **Mailcow** (свой сервер) и **Resend** — почта; **Telegram** — бот и оповещения
- Прод — свой VPS (systemd + nginx), деплой — GitHub Actions при push в `main`, см. [docs/Deploy.md](docs/Deploy.md)

## Портал

Версия продукта — поле `version` в `package.json`.

- **Роли:** user (студент), manager, admin
- **ЛК студента:** дашборд, курсы (SCORM), сертификаты, медиатека, уведомления, поддержка
- **Админка:** пользователи, курсы, сертификаты, медиа, оплаты, CRM, коммуникации, уведомления, AI-настройки,
  аудит, настройки, персональные товары, рассрочки
- **Менеджер:** тикеты, поиск пользователей, верификация заданий

Вход: `/login`, регистрация: `/register`. Тестовые аккаунты — [docs/Local-Prisma.md](docs/Local-Prisma.md).

## Как запустить

Нужен Node.js 20 (как в CI).

```bash
npm install
cp .env.example .env.local   # заполните NEXTAUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev
```

Сайт: **http://localhost:4000**. Если приложение не стартует — [docs/Local-Prisma.md](docs/Local-Prisma.md).

## Проверки и сборка

```bash
npm run check   # линтер + типы + тесты
npm run build
```

Перед коммитом — `npm run format:changed` (Prettier только для изменённых файлов).
Правила — [docs/Development-Standards.md](docs/Development-Standards.md).

## Деплой

Push в `main` → GitHub Actions (`.github/workflows/deploy.yml`): линтер, типы, тесты, сборка, выкладка на прод.
С машины владельца — `npm run deploy:rsync`. Одновременно оба способа не запускать.
Прод-сервер — [docs/Production-Server.md](docs/Production-Server.md); после выкладки — `npx tsx scripts/prod-verify.ts`.

## Переменные окружения

Полный список — [docs/Env-Config.md](docs/Env-Config.md). Минимум для локального запуска:

- `DATABASE_URL="file:./dev.db"`
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `NEXT_PUBLIC_URL` — полный URL сайта (для писем и ссылок)
- `PAYKEEPER_*` — только если проверяете оплату

## Структура

| Папка | Что в ней |
|---|---|
| `app/` | Маршруты: сайт, блог, `portal/`, `api/`; `sitemap.xml` и `robots.txt` генерируются |
| `components/` | React-компоненты; `sections/` — блоки лендинга, `ui/` — примитивы |
| `lib/` | Бизнес-логика и интеграции |
| `prisma/` | Схема и миграции |
| `content/` | Знания школы и бота, правила текстов |
| `scripts/` | Эксплуатация, каталог — [scripts/README.md](scripts/README.md) |
| `tests/` | `unit/`, `db/`, `e2e/` |
| `infra/` | systemd-юниты и шаблоны конфигов сервера |
| `docs/` | Документация, указатель — [docs/README.md](docs/README.md) |
| `private/` | Вне git: платный контент, ПДн, бэкапы (репозиторий публичный) |

`proxy.ts` — прокси-слой Next 16 (бывший `middleware.ts`): CSP, редиректы, защита маршрутов.
