# Changelog

All notable changes to the AVATERRA project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Переменные окружения в настройках (редактируемые, БД):** блок «Переменные окружения» на странице Настройки сделан редактируемым; значения (Resend API ключ, Telegram Bot Token, Cron secret, NEXTAUTH_URL) сохраняются в БД, секреты — в зашифрованном виде. Приложение использует их с приоритетом над .env (getEnvOverrides). Обновлены lib/email, contact, lib/telegram, telegram webhook, cron/mailings-send. Индикаторы «Состояние интеграций» учитывают и .env, и БД; добавлен CRON_SECRET. NEXTAUTH_SECRET и DATABASE_URL — только в .env.
- **Оплата: редирект и письмо после оплаты:** при создании счёта в PayKeeper передаётся `user_result_callback` (URL из настроек site_url + `/success`) — после оплаты покупатель перенаправляется на страницу «Оплата прошла успешно». В webhook после успешной оплаты курса покупателю отправляется email (Resend): «Оплата получена — доступ к курсу открыт», ссылки на вход и страницу результата.
- **Платежи (PayKeeper): тестовое подключение:** в Настройки → Платежи — чекбокс «Использовать тестовое подключение» и отдельные поля (сервер, логин, пароль, секрет для webhook). Конфиг из БД или env (PAYKEEPER_USE_TEST, PAYKEEPER_TEST_*).
- **Магазин на главной:** блок «Купить курс» загружает товары из GET `/api/shop/products` (активные Service с опубликованным курсом). Оплата по `serviceSlug`; POST `/api/payment/create` принимает `serviceSlug` или `tariffId`. Админ: блок «Товары для продажи на главной» на странице Оплаты (CRUD услуг). Возврат: для оплаченных заказов — кнопка «Возврат» (статус refunded, отзыв доступа к курсу); возврат средств — в ЛК PayKeeper.
- **Настройки AI: несколько моделей и API-ключей:** в блоке «Подключение LLM и параметры чат-бота» — раздел «Сохранённые API ключи» (добавление/удаление ключей с названием и провайдером); выбор сохранённого ключа или ввод своего для чат-бота и тьютора; выбор провайдера (DeepSeek, OpenAI, Anthropic, Другой) и модели из списка (или произвольная для «Другой»). Модель данных: LlmApiKey, LlmSetting.apiKeyId; API: GET/POST/DELETE `/api/portal/admin/llm-settings/api-keys`, POST с `api_key_id` в llm-settings.
- **Страница группы:** `/portal/admin/groups/[id]` — просмотр группы (название, описание, родитель, тип), редактирование (GroupFormModal), состав: курсы/медиа/участники в зависимости от moduleType с добавлением (модалка выбора из всех курсов, медиа или пользователей) и удалением из группы. В дереве групп — ссылка на страницу группы (иконка при наведении). GET `/api/portal/admin/media` для списка медиа в пикерах.
- **Рассылки и коммуникации: добавление и исключение по группам:** в рассылках (recipientConfig) и в отправке коммуникаций — тип получателей «По группам пользователей» (включить участников выбранных групп) и блок «Исключить группы» (убрать из списка получателей участников выбранных групп). Валидация: groupIds, excludeGroupIds в lib/validations; логика в lib/mailing-send.ts и app/api/portal/admin/comms/send/route.ts.
- **Группы в Медиатеке и Пользователях:** сайдбар с деревом групп на страницах «Медиатека» и «Пользователи» (фильтрация по группе); в диалоге редактирования ресурса медиа — блок «Группы ресурса»; в карточке пользователя — вкладка «Группы» (роль участник/модератор). API: GET/POST/DELETE `/api/portal/admin/media/[id]/groups`, `/api/portal/admin/users/[id]/groups`. См. docs/Groups-Plan.md.
- **Группы: редактирование и удаление из дерева:** в сайдбаре групп (Курсы, Медиатека, Пользователи) при наведении на группу отображаются кнопки «Редактировать» и «Удалить»; редактирование открывает модалку формы группы, удаление — диалог подтверждения (дочерние группы отвязываются, связи снимаются). Дерево обновляется после операций.
- **Health check:** GET /api/health — возвращает 200 и `{ ok: true }` для мониторинга и балансировщиков (см. Deploy.md).
- **Prisma + SQLite:** локальная БД (prisma/schema.prisma, lib/db.ts). Миграции, seed.
- **NextAuth:** Credentials provider вместо Supabase Auth.
- **docs/Local-Prisma.md:** инструкция локального запуска.
- **Оферта и политика конфиденциальности:** полноценный контент на страницах /oferta и /privacy (разделы по предмету договора, оплате, ПД, правам пользователей).
- **SEO:** метаданные (title, description, openGraph) для /oferta и /privacy; app/sitemap.ts и app/robots.ts (sitemap.xml, robots.txt с disallow для /portal/, /api/, /auth/).
- **Редизайн админки (план docs/Admin-Redesign-Plan.md):** PageHeader и единая навигация; компонент Card, табы в карточке пользователя; колонка №, пагинация +5/+10/+50, поиск «Найти в списке», ConfirmDialog при конвертации лида; EmptyState во всех таблицах и табах, TableSkeleton при загрузке; каталог /portal/admin/notification-sets; форма «Добавить пользователя» (POST /api/portal/admin/users); aria-label для доступности; раздел «Админ-панель» в docs/Support.md.

### Changed
- **Архитектура:** Supabase удалён, переход на Prisma + SQLite. Хранилище — public/uploads/.
- **Документация:** Project.md, README, Support, Deploy, Tasktracker — обновлены под Prisma.

### Removed
- **Группы публикаций (рубрики):** функционал удалён — модель PublicationGroup, API и страница «Группы публикаций», выбор рубрики в форме публикации, фильтр по группе в API. Публикации остаются без рубрик.
- **Supabase:** lib/supabase/, пакеты @supabase/*, supabase; папка supabase/ (миграции, config).
- **docs/Supabase-Setup.md, Local-NoCloud.md, LocalDB.md** — удалены как устаревшие.

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
