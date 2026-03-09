# Руководство по поддержке AVATERRA

Краткий справочник: где что лежит, как вносить правки.

---

## Структура проекта

| Папка/файл | Назначение |
|------------|------------|
| `app/` | Страницы и API (Next.js App Router) |
| `app/(auth)/` | Логин, регистрация, сброс пароля |
| `app/portal/` | Портал: student, admin, manager |
| `app/api/` | API-маршруты |
| `components/` | React-компоненты (UI, секции, портал) |
| `lib/` | Утилиты: paykeeper, supabase, email, telegram, certificates |
| `content/` | База знаний для чат-бота (markdown) |
| `supabase/migrations/` | SQL-миграции БД |
| `docs/` | Документация |
| `.env.example` | Пример переменных окружения |

---

## Частые задачи

### Изменить тексты на главной

- Секции: `components/sections/` (Hero, About, Pricing, Contact и т.д.)
- Контент: `docs/Content.md` (референс)

### Добавить/изменить тариф

- Карточки: `components/sections/Pricing.tsx` (массив `tariffs`)
- Создание заказа: `app/api/payment/create/route.ts` (TARIFFS)
- Webhook: таблица `services` в Supabase (paykeeper_tariff_id → course_id)

### Настроить чат-бота

- Промпты: Admin → Настройки AI (`/portal/admin/ai-settings`)
- База знаний: `content/knowledge-base-body-never-lies.md`
- API: `app/api/chat/route.ts`

### Добавить страницу в портал

- Student: `app/portal/student/` + пункт в `app/portal/student/layout.tsx`
- Admin: `app/portal/admin/` + пункт в `app/portal/admin/layout.tsx`
- Manager: `app/portal/admin/manager/` + пункт в layout

### Запустить миграции Supabase

```bash
npx supabase db push
```

Или выполнить SQL из `supabase/migrations/` вручную в Supabase Dashboard.

---

## Переменные окружения

См. `.env.example`. Обязательные для портала:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_URL` (для ссылок в письмах и чате)

Для платежей: PayKeeper. Для уведомлений: Resend, Telegram.

---

## Документация

- `docs/Project.md` — цели, архитектура
- `docs/Content.md` — тексты страниц
- `docs/Deploy.md` — деплой (Vercel, VPS)
- `docs/Server-Setup.md` — настройка сервера (PM2, Nginx)
- `docs/Supabase-Setup.md` — Supabase, миграции, первый админ
- `docs/Diary.md` — дневник решений
- `CHANGELOG.md` — история изменений
