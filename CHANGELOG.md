# Changelog

All notable changes to the AVATERRA project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **vercel.json:** заголовки безопасности (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- **docs/Spec.md:** ТЗ v3.0 — функциональные блоки, интеграции, референсы дизайна.
- **Deploy.md:** чек-лист перед деплоем.
- **qa.md:** таблица «Текущее состояние» — ответы на вопросы из реализованной архитектуры.
- **Оптимизация изображений:** next/image для логотипа (Header, Footer), превью курсов; remotePatterns для Supabase Storage.
- **Auth callback:** /auth/callback — обмен token_hash на сессию (verifyOtp), сохранение в cookies. Сброс пароля: redirectTo → callback → /auth/update-password.
- **Страница смены пароля:** /auth/update-password — форма после перехода по ссылке восстановления.
- **lib/supabase/server-cookies.ts** — createClientWithCookies для route handlers с cookie storage.

### Changed
- **docs/Supabase-Setup.md:** в Redirect URLs добавлен wildcard `https://*.vercel.app/auth/callback` для Vercel.
- **docs/Deploy.md:** раздел «Релиз v3.0.0» с командами для тега и push; чек-лист дополнен.

### Planned
- Дополнительные улучшения по мере необходимости

---

## [3.0.0] - 2025-03-09

### Added
- **Портал:** три роли (user, manager, admin), middleware RBAC, shell с header и сайдбарами.
- **Auth:** страницы login, register, reset-password; Supabase Auth; сессия в cookies (@supabase/ssr).
- **ЛК студента:** дашборд, мои курсы, SCORM-плеер (iframe + API progress/url), сертификаты (PDF, скачивание), медиатека, уведомления, профиль.
- **Админка:** пользователи (таблица, фильтр active/archived), загрузка SCORM (ZIP → Storage), заглушки курсов, сертификатов, медиатеки, оплат, CRM, коммуникаций, AI, аудита, настроек.
- **Менеджер:** заглушки дашборда, тикетов, пользователей, верификации заданий.
- **API:** scorm/progress (GET/POST), scorm/url, certificates/[id]/download, admin/courses/upload, telegram/webhook.
- **БД:** миграции 001 (схема портала), 002 (RLS), 003 (email в profiles); таблицы profiles, courses, enrollments, scorm_progress, certificates, media, notifications, tickets, audit_log, comms_templates, llm_settings, services, user_energy, phygital_verifications.
- **Интеграции:** Resend в /api/contact (уведомление о заявке); lib/email, lib/telegram, lib/audit; Telegram webhook (команды /start, /progress, /cert, /help).
- **Версионирование:** CHANGELOG.md, SemVer, package.json 3.0.0.
- **Автосертификат:** при completion_status=completed в SCORM progress — запись в certificates и notification.
- **Чат-бот:** чтение system_prompt, model, temperature, max_tokens из llm_settings (key=chatbot).
- **Webhook PayKeeper:** при оплате — enrollment, notification, привязка user_id (services.paykeeper_tariff_id → course_id).
- **Поддержка студента:** /portal/student/support, POST /api/portal/tickets.
- **Дашборд менеджера:** метрики (тикеты, верификации), последние тикеты.
- **Экспорт CSV оплат:** GET /api/portal/admin/payments/export.
- **Admin Media:** загрузка файлов, POST /api/portal/admin/media/upload, bucket media, миграция 005.
- **Admin дашборд:** график выручки по дням (recharts).
- **Admin:** смена роли/статуса пользователя (PATCH /api/portal/admin/users/[id]).
- **CRM:** конвертация лида (POST /api/portal/admin/leads/convert), смена статуса (PATCH /api/portal/admin/leads/[id]), воронка (CrmFunnelChart).
- **Шкала Энергии:** бейджи по XP (Новичок, Практик, Уверенный, Мастер, Эксперт).
- **Документация:** docs/Supabase-Setup.md, docs/Support.md.

### Changed
- Палитра Tailwind/globals: primary #2D1B4E, secondary #D4AF37, dark #0A0E27.
- Hero: градиент и кнопки переведены на primary/dark/secondary.
- lib/paykeeper: ESM import crypto вместо require.
- lib/supabase/client: createBrowserClient (@supabase/ssr) для cookies.

### Fixed
- Очистка: удалены dist/, src/; в .gitignore добавлены Zone.Identifier.

---

## [2.0.0] - 2025-03-09

### Added
- Next.js 14 (App Router) landing page for AVATERRA school
- Hero with Three.js particle background, typewriter, tilt card
- Sections: About, Program, Author, Testimonials, Pricing, FAQ, Contact
- PayKeeper integration: invoice creation, webhook handler
- Supabase: optional storage for leads and orders
- DeepSeek AI chatbot with RAG knowledge base
- Payment modal, sticky CTA, contact form with honeypot validation
- Pages: oferta, privacy, success (post-payment)
- CI: GitHub Actions build on push to main

### Technical
- Tailwind CSS, Framer Motion, React Three Fiber, lucide-react
- lib/paykeeper.ts, lib/supabase/client.ts, server.ts

---

## [1.0.0] - 2025-02-14

### Added
- Initial project setup (Vite prototype, later migrated to Next.js)
- Documentation: Project.md, Content.md, Media.md, Tasktracker.md, Diary.md

[Unreleased]: https://github.com/avaterra/ALETHEIA/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/avaterra/ALETHEIA/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/avaterra/ALETHEIA/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/avaterra/ALETHEIA/releases/tag/v1.0.0
