# Настройка Supabase для AVATERRA

Инструкция по первой настройке Supabase: миграции, buckets, первый администратор.

---

## 1. Создать проект Supabase

1. Зайдите на [supabase.com](https://supabase.com) и создайте проект.
2. В **Settings → API** скопируйте:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (секретный ключ, не показывать на клиенте)

---

## 2. Применить миграции

В папке проекта:

```bash
npx supabase db push
```

Или вручную в **SQL Editor** Supabase Dashboard выполните по порядку:

1. `supabase/migrations/001_portal_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_profiles_email.sql`
4. `supabase/migrations/004_seed_services.sql`
5. `supabase/migrations/005_storage_media_bucket.sql`

---

## 3. Storage buckets

Миграция 005 создаёт bucket `media`. Bucket `scorm` нужен для загрузки SCORM-пакетов курсов.

В **Storage** Supabase Dashboard:

1. Создайте bucket `scorm` (если нет) — **Public** или **Private** (для private нужны signed URLs, что уже реализовано в API).
2. Bucket `media` создаётся миграцией 005; если его нет — создайте вручную, Public.

### Политики Storage (если bucket private)

Для `scorm` — разрешить чтение аутентифицированным пользователям с enrollment на курс. Для простоты можно сделать bucket Public.

---

## 4. Назначить первого администратора

После регистрации первого пользователя через `/register` нужно выдать ему роль `admin`.

### Вариант A: через SQL Editor

```sql
-- Замените EMAIL на email зарегистрированного пользователя
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

### Вариант B: по user id

```sql
-- Узнать id: Auth → Users в Dashboard, или из таблицы profiles
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'uuid-пользователя';
```

После этого пользователь сможет заходить в `/portal/admin` и назначать роли другим через интерфейс **Пользователи**.

---

## 5. Связать tariff_id с курсом (для webhook PayKeeper)

Чтобы при оплате автоматически создавался enrollment, в таблице `services` должна быть запись с `paykeeper_tariff_id = 'course'` и `course_id` — id курса.

Миграция 004 создаёт такую запись, если есть хотя бы один курс. Если курсов нет:

1. Создайте курс в **Admin → Курсы**.
2. Выполните миграцию 004 или вручную:

```sql
INSERT INTO public.services (slug, name, price, paykeeper_tariff_id, course_id, is_active)
SELECT 'course-avaterra', 'Курс AVATERRA', 25000, 'course', id, true
FROM public.courses
WHERE status IN ('published', 'draft')
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (slug) DO UPDATE SET
  paykeeper_tariff_id = EXCLUDED.paykeeper_tariff_id,
  course_id = EXCLUDED.course_id;
```

---

## 6. Переменные окружения

Добавьте в `.env` (и в Vercel/сервер):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

См. `.env.example` для полного списка.
