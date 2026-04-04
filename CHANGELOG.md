# Changelog

All notable changes to the AVATERRA project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **План доработок портала (Portal improvements):** Безопасность: фильтр `revokedAt: null` в списке и API скачивания сертификатов; проверка роли (defense-in-depth) в страницах менеджера (verifications, tickets, dashboard); проверка enrollment в verifications/upload; документация media-access. UX: исправлены ссылки на тикеты в UserDetailTabs; ссылки на пользователей в VerificationsList по роли (manager→/portal/manager/users, admin→/portal/admin/users); убраны невалидные Tailwind-классы в PortalHeader; удалено дублирование мобильного бургер-меню; column visibility в UsersTable; актуальное имя менеджера в TicketThread при смене. Навигация: ссылки на пользователей в таблице тикетов; ссылки на курсы и сертификаты в карточке пользователя менеджера; замена хардкода цветов на CSS-переменные; loading.tsx для SCORM player; Promise.all в profile page; реальный счётчик непрочитанных уведомлений в header; пустое состояние пагинации «Нет записей»; локализованные роли в UsersTable (Студент, Менеджер, Администратор).
- **Тикеты: автоответ при создании и база знаний из обращений.** В Настройках AI — блок «Автоответ при создании обращения» (флаг `ticket_auto_reply_enabled`): при создании тикета с текстом LLM формирует краткий ответ по базе знаний; при «уверенном» ответе (без дискалеймеров) он сохраняется как первое сообщение от поддержки и отправляется студенту на email. Для админа на странице тикета при статусе «Решён»/«Закрыт» — блок «Добавить в базу типовых ответов» (тема + вопрос + ответ); API `POST /api/portal/admin/ai-settings/knowledge-base/append`. Файлы: lib/ticket-auto-reply.ts, TicketAutoReplyBlock, TicketThread (canAddToKb), GET/PATCH ticket-auto-reply.
- **Верификация: загрузка видео студентом.** API `POST /api/portal/verifications/upload` (видео до 200 МБ в public/uploads/verifications/). На странице «Задания на проверку» и в блоке верификации на странице курса — кнопка «Загрузить видео»; форма редактирования задания (pending) поддерживает URL вида `/uploads/...`. Учёт уроков с обязательной верификацией при выдаче сертификатов (auto + массовая).
- **Отчётность: экспорт в XLSX.** На странице «Отчётность» добавлена кнопка «XLSX» для выгрузки текущего отчёта (сводка, по курсам, по слушателям, по периоду, слушатели курса) в формате Excel.
- **Единая пагинация таблиц.** Во всех таблицах портала (Медиатека, Курсы, Пользователи, Оплаты, CRM, Аудит, Сертификаты, Коммуникации, Рассылки, Мониторинг, Тикеты и др.) используется один стандарт: `STANDARD_PAGE_SIZES = [10, 25, 50, 100]` из `components/ui/TablePagination.tsx`; одинаковый вид блока «Записи X–Y из Z» и навигации.
- **Модуль верификации заданий (продолжение):** на странице верификации менеджера — полное название курса, ссылка на карточку пользователя (для admin), адаптивная сетка на всю ширину; на странице курса студента — блок «Отправки по этому курсу» со статусами (на проверке / одобрено / отклонено) и комментарием при отклонении; в админке курса — блок «Уроки с верификацией» (выбор уроков из SCORM-манифеста, по которым требуется отправка видео); у студента — подсказка «По этому курсу нужно отправить видео по урокам: …» при настройке обязательных уроков. Поле `Course.verificationRequiredLessonIds` (JSON array), миграция `20260318100000_course_verification_required_lessons`.
- **Портал — UX и метаданные:** единый header (PortalHeader в layout); редирект `/portal` по роли на соответствующий дашборд; переключатель ролей в сайдбаре (Админка / Кабинет менеджера / ЛК студента); иконка уведомлений ведёт по ролям (журнал уведомлений / тикеты / уведомления); loading-состояние для сегмента /portal; динамический title портала из настроек (generateMetadata в layout); метаданные (title) для основных страниц портала — дашборды, курсы, профиль, поддержка, сертификаты, уведомления, медиатека, помощь (студент); тикеты, пользователи, верификация, помощь (менеджер); пользователи, курсы, настройки, оплаты, CRM, медиатека, сертификаты, коммуникации, рассылки, аудит, отчёты, группы, публикации, мониторинг, журнал уведомлений, наборы и шаблоны уведомлений, шаблоны сертификатов, настройки AI, помощь (админ). Для динамических маршрутов добавлен **generateMetadata**: тикет (менеджер/студент) — тема; курс (студент/админ) — название; пользователь (админ) — displayName; прогресс участника — «Курс — Участник»; набор уведомлений, рассылка, медиа — соответствующие названия.
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
- **Доработки по плану тестирования:** PaymentModal — toast вместо alert при ошибке создания платежа; /success — выделенный блок «зарегистрируйтесь с тем же email» для гостя, приоритет кнопки «Зарегистрироваться»; регистрация → redirect с ?registered=1, на login — блок «Аккаунт создан»; пагинация тикетов студента (10/25/50, навигация); seed — разнообразие уведомлений, тикетов, публикаций; исправление опечатки «Тело не врем» в курсах; витрина — 4 основных тарифа (consult, group, course, online) в seed; валидация paykeeperTariffId в форме сервиса (предупреждение при courseId без тарифа); логирование в processPaidOrder при tariffId без привязки к курсу; страница выхода на русском (app/signout/page.tsx, pages.signOut). **Автосоздание аккаунта при оплате курса гостем:** в processPaidOrder при отсутствии пользователя создаётся User + Profile + Enrollment, отправляется письмо со ссылкой «Установить пароль» (48 ч). При ошибке создания (например, уникальный email) — fallback на поиск существующего пользователя.
- **Устранение замечаний UI (browser-тест):** Header — z-[100] isolate для корректного отображения поверх Hero (клик «Вход»); Signout — await signOut, индикатор «Выход…»; lib/format-person-name.ts — форматирование имён «Имя Фамилия» для отображения лидов в RecentEvents и CrmLeadsClient.
- **Устранение замечаний UI (тестирование):** редирект при выходе — callbackUrl с window.location.origin (остаёмся на текущем порту); типы уведомлений — formatNotificationType (mailing→Рассылка и др.); в seed добавлена тема «Проблема с прохождением курса» (орфография).
- **Архитектура:** Supabase удалён, переход на Prisma + SQLite. Хранилище — public/uploads/.
- **Документация:** Project.md, README, Support, Deploy, Tasktracker — обновлены под Prisma.

### Removed
- **Группы публикаций (рубрики):** функционал удалён — модель PublicationGroup, API и страница «Группы публикаций», выбор рубрики в форме публикации, фильтр по группе в API. Публикации остаются без рубрик.
- **Supabase:** lib/supabase/, пакеты @supabase/*, supabase; папка supabase/ (миграции, config).
- **docs/Supabase-Setup.md, Local-NoCloud.md, LocalDB.md** — удалены как устаревшие.

---

## [3.3.0] - 2026-04-05

### Added
- **Чаты и Markdown:** компонент `ChatMarkdown` и `lib/linkify-bare-urls.ts` — голые `http(s)://` в ответах LLM становятся кликабельными ссылками (внешние — `target="_blank"`). Подключено в виджете лендинга, FAQ, тесте чата в админке, `CourseAIChat`, просмотре бесед тьютора в админке.
- **Шаблоны промптов для тьютора курса:** в «Настройки AI» → шаблоны — вкладки «Лендинг (публичный чат)» и «Тьютор в курсе (SCORM)»; API `GET .../prompt-templates?scope=chatbot|course-tutor`, `POST` с полем `scope`. Активный шаблон `course-tutor` имеет приоритет над полем playbook в блоке LLM; при ответах `ai-assist` обновляются `usageCount` / `lastUsedAt`. Генерация текста шаблона учитывает вкладку (разные системные инструкции).
- **Помощь в портале:** карточка «AI-тьютор в плеере курса» (`#ai-tutor`); для админов — блок «AI-тьютор: настройка и беседы» (`#ai-tutor-admin`); кликабельные ссылки в FAQ (задания, история заряда); клиентская прокрутка к якорю при переходе и при `hashchange` (`useScrollToHelpHash`, уважение `prefers-reduced-motion`).
- **Палитра команд (⌘K / Ctrl+K):** для студента — «История заряда», «Помощь: AI-тьютор в курсе»; для менеджера и админа — пункты «Как у студента» (дашборд, курсы, история заряда); для админа — «Помощь: AI-тьютор (настройка и беседы)».
- **UX AI-тьютора:** на странице курса студента — подсказка про чат в плеере + ссылка в «Помощь»; при выключенном тьюторе — пояснение и ссылка на «Поддержку»; в `CourseAIChat` — `title` на плавающей кнопке, ссылка «Как устроен AI-тьютор» в пустом чате; в админке курса и в «Настройки AI» (блок тьютора) — ссылки на `#ai-tutor-admin`; синхронизация `initialEnabled` в `CourseAiTutorBlock` при смене данных с сервера.

### Changed
- **ЛК студента / история заряда:** убран редирект на «домашнюю» роль для не-`user` на `/portal/student/gamification` — админ и менеджер в ЛК студента видят свою историю начислений без сброса в админку.
- **Страница курса студента:** удалена кнопка «Админка» из шапки (переход в админку — через блок учётной записи в сайдбаре).

### Removed
- **Неиспользуемый `CourseTutorForm.tsx`** (дублировал настройки тьютора и при сохранении обнулял `system_prompt`).

---

## [3.2.0] - 2026-04-04

### Added
- **Публичный сайт (SEO):** страницы `/courses`, `/about`, `/faq`, `/contacts`; кастомная `app/not-found.tsx`; модули `lib/seo/*`, общий контент о мастере (`lib/content/about-master.ts`); хлебные крошки, перелинковка блог ↔ курс с якорями `#module-N`; расширенные `sitemap.ts` / метаданные главной; JSON-LD (Person, отзывы с AggregateRating на главной, Article, FAQ на `/faq`).
- **Аналитика:** `lib/analytics-events.ts`, события GA4 и цели Яндекс.Метрики (просмотр курса, запись, форма оплаты, скролл к тарифам, вовлечённость 2 мин).
- **Документация:** секция smoke-проверки после деплоя в [Deploy.md](docs/Deploy.md); [Backlog-Optional.md](docs/Backlog-Optional.md); обновления Tasktracker, Diary, Production-Server.

### Changed
- **HTTP:** глобальные заголовки безопасности в `next.config.mjs` (nosniff, frame, referrer-policy).
- **Медиатека (админ):** модалка превью видео без обрезки меню скорости Plyr; подсказка в `MediaVideoPanel`.

---

## [3.1.0] - 2026-03-10

### Added
- **Аудит пользовательского пути (docs/User-Journey-Audit.md):** привязка оплаченных заказов при регистрации и при первом входе в ЛК (claimPaidOrdersForUser); письмо «Заявка принята» после формы контакта; экран «Заявка отправлена» с CTA на оплату; письмо при оплате без курса (консультация); письмо при конвертации лида со ссылкой «Установить пароль»; страница /set-password по токену (PasswordToken, 48 ч); welcome-уведомление после регистрации; уведомление менеджеру и автоответ студенту при создании тикета; персонализация /success для авторизованных; сброс пароля по email (/reset-password, /api/auth/forgot-password); шаблоны писем об оплате в Настройках (email_payment_course_*, email_payment_generic_*); онбординг-подсказка на дашборде студента (localStorage); /success?order= для гостя с маскированным email; шаблоны быстрых ответов в тикете для менеджера; связь Lead ↔ Order (lastOrderNumber при оплате, отображение в CRM); авто-тикет «Нет доступа» (Ticket.orderNumber, тема и привязка заказа); ссылка на заказ в тикете для админа (payments?search=); поиск по заказу на странице Оплаты через ?search=.

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
