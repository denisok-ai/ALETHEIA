# Трекер задач AVATERRA

Отслеживание прогресса разработки. Основа — этапы и требования из `docs/Project.md`.

**Версия продукта (package.json):** 3.7.0 — см. CHANGELOG [3.7.0]: Security hardening (2026-07-10); Telegram bot commands; xray proxy. Предыдущий релиз [3.6.0] (2026-06-27): персональные товары, рассрочка.  
**База трекера:** 3.0 (портал, роли, SCORM, сертификаты, коммуникации).  
**Трекер актуализирован 2026-08-31:** этапы 17–24 внесены задним числом по `docs/Diary.md` и `CHANGELOG.md` за 16.07–30.08 (в момент работы записи велись только в дневник). Открытые задачи собраны в разделе «Открытое» в конце файла.  
**Легенда статусов:** Не начата | В процессе | Завершена  
**Приоритеты:** Критический | Высокий | Средний | Низкий

---

## Этап 3.0 — Портал (v3.0.0)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Версионирование (CHANGELOG, SemVer) | Высокий | Завершена | CHANGELOG.md, v2.0.0 тег |
| Очистка (dist/, src/, Zone.Identifier, палитра) | Средний | Завершена | Унификация цветов, .gitignore |
| Схема БД (Prisma + SQLite) | Критический | Завершена | User, Profile, Course, Enrollment, ScormProgress, Certificate, Media, Notification, Ticket, AuditLog, LlmSetting, Service, Lead, Order |
| Auth (login, register, reset-password) | Критический | Завершена | NextAuth Credentials, app/(auth)/* |
| Middleware RBAC | Критический | Завершена | Защита /portal/student, /portal/admin, /portal/manager |
| Портальный shell и сайдбары | Высокий | Завершена | layout.tsx, PortalHeader, PortalSidebar по ролям |
| ЛК студента (дашборд, курсы, сертификаты, медиатека, уведомления, профиль) | Высокий | Завершена | Страницы и API |
| SCORM (плеер, API progress, URL) | Высокий | Завершена | iframe + /api/portal/scorm/* |
| SCORM: метрики на карточках, passed/completed, обновление после коммита | Средний | Завершена | Парсинг CMI и CommitObject, балл/время на карточке и странице курса, refresh после коммита в плеере; Diary 2026-03-10 |
| Сертификаты (PDF, выдача, скачивание) | Высокий | Завершена | lib/certificates.tsx, API download |
| Admin: пользователи (таблица, фильтр) | Высокий | Завершена | UsersTable, TanStack Table |
| Admin: загрузка SCORM (ZIP) | Высокий | Завершена | POST /api/portal/admin/courses/upload, jszip |
| Telegram long-polling, lib/telegram-bot, оповещения админов | Средний | Завершена | **Long-polling** на проде: `aletheia-telegram-poll.service` → `lib/telegram-long-poll.ts` → `routeTelegramUpdate`; webhook stub `/api/portal/telegram/webhook`; команды `/start`, `/about`, `/progress`, `/cert`, `/help`, `/faq`, `/myid`, `/admin_on`; `lib/telegram-admin-notify.ts`; регистрация команд из админки и `scripts/setup-telegram-webhook.ts` (deleteWebhook + setMyCommands); см. Support.md § Telegram |
| SMM + Site Radar в едином боте (DenisBot1 → TS) | Высокий | Завершена | Prisma content-модели; `lib/content/*`, `content/avaterra.yaml`; `aletheia-jobs.service`; админ-меню «Контент (SMM)»; dry_run по умолчанию; `lib/image-gen` стаб; деплой rsync 2026-06-15 |
| Страницы-заглушки Admin/Manager (CRM, финансы, AI, аудит, тикеты, верификация) | Средний | Завершена | Наполнение — следующие итерации |
| Автосертификат при 100% SCORM | Высокий | Завершена | POST progress → certificates + notification |
| Чат-бот: llm_settings из БД | Средний | Завершена | /api/chat читает system_prompt, model, temperature |
| Webhook PayKeeper: enrollment + notification | Высокий | Завершена | services.paykeeper_tariff_id → course_id, enrollment |
| Студент: создание тикета | Средний | Завершена | /portal/student/support, POST /api/portal/tickets |
| Дашборд менеджера с метриками | Низкий | Завершена | Открытые тикеты, на верификации, последние тикеты |
| Экспорт CSV оплат | Средний | Завершена | GET /api/portal/admin/payments/export |
| Admin Media: загрузка файлов | Средний | Завершена | POST /api/portal/admin/media/upload, bucket media |
| CRM: конвертация лида в пользователя | Высокий | Завершена | POST /api/portal/admin/leads/convert, создание User+Profile в Prisma |
| CRM: смена статуса лида | Средний | Завершена | PATCH /api/portal/admin/leads/[id] |
| Admin дашборд: recharts | Средний | Завершена | График выручки по дням (30 дней) |
| Admin: смена роли/статуса пользователя | Высокий | Завершена | PATCH /api/portal/admin/users/[id], UsersTable |
| CRM: воронка лидов | Средний | Завершена | CrmFunnelChart (recharts) |
| Шкала Энергии: бейджи | Средний | Завершена | Новичок, Практик, Уверенный, Мастер, Эксперт по XP |
| Документация Support и Local-Prisma | Низкий | Завершена | docs/Support.md, docs/Local-Prisma.md |
| Переход на локальную БД (Prisma) | Критический | Завершена | Supabase удалён, Prisma+SQLite, NextAuth, локальное хранилище |
| Подготовка к деплою (сборка, чек-лист, PostgreSQL) | Высокий | Завершена | npm run build проверен, Deploy.md — раздел БД для прода |
| Медиатека: PDF в dev без краша | Высокий | Завершена | Просмотр PDF в портале через `iframe` (нативный UI браузера); пакет `react-pdf` удалён из зависимостей просмотрщика. |
| Медиатека: Plyr в превью (перемотка, скорость) | Высокий | Завершена | `MediaVideoPanel` (Plyr, settings/speed); превью в админке (`PreviewDialog` без обрезки меню); страница просмотра студента; подсказка про скорость в UI |
| Медиатека: многостраничный PDF (страницы, зум) | Средний | Завершена | В iframe средствами Chrome/Firefox/Edge; кастомная панель react-pdf отменена из‑за webpack/pdf.js в dev. |

## Этап 3.x — Настройки из интерфейса

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Настройки почты (Resend/SMTP), интеграции, импорт env из UI | Высокий | Завершена | `SettingsForms.tsx`, `PATCH settings`, `lib/settings-import-env.ts`; типовые уведомления в `DEFAULT_NOTIFICATION_TEMPLATES`; шаблоны коммуникаций — `lib/default-comms-templates.ts`, `npm run db:upsert-comms-templates`; см. Diary 2026-04-29 |

---


| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Ответить на вопросы в qa.md | Критический | Завершена | Текущее состояние зафиксировано в qa.md (таблица реализованного) |
| Согласовать контент и структуру по прототипу | Высокий | Завершена | Тексты в docs/Content.md, структура в Project.md, медиа в docs/Media.md |
| Зафиксировать ТЗ / макеты | Высокий | Завершена | docs/Spec.md — функциональные блоки, интеграции, референсы |

---

## Этап 2. Базовая вёрстка

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Выбор и настройка стека (фреймворк, сборка) | Критический | Завершена | Vite + HTML/CSS/JS, package.json, vite.config.js |
| Главная страница (все секции прототипа) | Критический | Завершена | Все секции в index.html, стили в src/style.css, контент из Content.md |
| Одностраничный лендинг или мультистраница | Высокий | Завершена | Одностраничный лендинг как прототип |
| Общие компоненты (шапка, подвал, навигация) | Высокий | Завершена | Шапка с навигацией и бургер-меню, футер с CTA в index.html |

---

## Этап 3. Формы и заявки

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Форма обратной связи | Критический | Завершена | Форма в блоке «Контакты» отправляет данные в POST /api/contact |
| Форма записи/заявки на курс | Критический | Завершена | Все кнопки «Записаться» ведут на #contact; одна общая форма заявок |
| Обработка и хранение заявок | Критический | Завершена | API /api/contact; запись в leads, уведомление Resend |
| Валидация и защита форм | Высокий | Завершена | Honeypot (поле website), проверка телефона (≥10 цифр), сообщения об ошибках |

---

## Этап 4. Интеграции (по решению)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Подключение приёма платежей | Высокий | Завершена | PayKeeper (lib/paykeeper), /api/payment/create, webhook с enrollment |
| Уведомления (email/мессенджеры) | Средний | Завершена | Resend в /api/contact; Telegram long-polling + admin notify; notifications в БД |

---

## Этап 5. Контент и SEO

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Финальные тексты и медиа | Высокий | Завершена | Тексты в docs/Content.md; медиа: фото Татьяны с прототипа, остальное по docs/Media.md |
| Мета-теги и базовое SEO | Средний | Завершена | title, description, Open Graph, metadataBase, robots в layout.tsx |
| Метаданные и sitemap/robots | Средний | Завершена | metadata для /oferta, /privacy; app/sitemap.ts, app/robots.ts (публичные пути, disallow /portal/, /api/, /auth/) |
| Оптимизация загрузки (изображения, ресурсы) | Средний | Завершена | next/image для логотипа, курсов |
| Расширенное SEO (маршруты, JSON-LD, аналитика) | Средний | Завершена | /courses, /about, /faq, /contacts, not-found; метаданные главной; перелинковка; события GA4/Метрика; см. Diary 2026-04-04 |

---

## Этап 6. Запуск и поддержка

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Подготовка к релизу (CHANGELOG, чек-лист, predeploy) | Высокий | Завершена | CHANGELOG дополнен; Deploy.md — чек-лист, проверка после деплоя; npm run predeploy (lint+build) |
| Деплой на прод | Критический | Завершена | Прод avaterra.pro на VPS 95.181.224.70 (`/opt/ALETHEIA`, systemd `aletheia` за nginx) работает с 06.2026; smoke и `/api/health` стабильны. Инфраструктура выката развита в этапе 19. См. [Production-Server.md](Production-Server.md) |
| Документация для поддержки | Низкий | Завершена | docs/Support.md, docs/Local-Prisma.md |

---

## Этап 7. Редизайн админки (план в docs/Admin-Redesign-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Фаза 1: PageHeader и единая навигация | Высокий | Завершена | Компонент PageHeader (Breadcrumbs + H1 + описание + действия); «К списку» на users/[id], courses/[courseId], notification-sets/[id], enrollments/[userId] |
| Фаза 2: Единые карточки и табы в карточке пользователя | Высокий | Завершена | Компонент Card (components/portal/Card.tsx), табы на users/[id] (UserDetailTabs), Card на dashboard и audit |
| Фаза 3: Таблицы, пагинация, поиск, ConfirmDialog | Средний | Завершена | Колонка № (UsersTable, Media, Audit, Certificates, CRM, Communications, Payments); единая пагинация STANDARD_PAGE_SIZES [10, 25, 50, 100] и «Страница N из M» на всех страницах (media, courses, audit, certificates, payments, CRM, communications, mailings, мониторинг, тикеты и др.); поиск «Найти в списке» в media и communications (шаблоны); ConfirmDialog при конвертации лида в CRM |
| Фаза 4: EmptyState и индикация загрузки | Средний | Завершена | EmptyState во всех таблицах и табах (пользователи, медиа, аудит, сертификаты, CRM, коммуникации, оплаты, курсы, участники/результаты/уведомления курса, табы пользователя); TableSkeleton при асинхронной загрузке (аудит, участники, результаты, уведомления) |
| Фаза 5: Недостающий функционал | Низкий | Завершена | Карточка заказа в модалке оплат; каталог /portal/admin/notification-sets; форма «Добавить пользователя» (кнопка в шапке раздела Пользователи, модалка: email, пароль, имя, роль), API POST /api/portal/admin/users |
| Фаза 6: Доступность и документация | Низкий | Завершена | Добавлены aria-label у кнопок «Подробнее», доступа, завершения, пагинации; в docs/Support.md — раздел «Админ-панель: разделы и типовые действия» |

---

## Этап 8. Модуль «Публикации» (план в docs/Publications-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Модель данных (Publication, PublicationComment) | Высокий | Завершена | Prisma: тип (news/announcement), статус (active/closed), дата размещения, анонс, контент (HTML), ключевые слова, просмотры, рейтинг, комментарии. PublicationGroup удалён. |
| API админки: CRUD публикаций | Высокий | Завершена | GET list, POST create, GET/PATCH/DELETE [id]; fallback названия из первых 50 символов контента |
| Админ-интерфейс: каталог, форма, фильтр по типу, поиск | Высокий | Завершена | Таблица, форма создания/редактирования (название, тип, статус, дата, анонс, контент, ключевые слова, разрешить комментарии/оценку) |
| Публичный API и логика видимости (active + publishAt ≤ now) | Высокий | Завершена | Список видимых публикаций для главной; одна публикация с инкрементом просмотра |
| Виджет «Новости» на главной | Высокий | Завершена | Последние N публикаций: новости — заголовок, дата, анонс, «Читать далее»; объявления — по макету |
| Публичная страница публикации (полный текст) | Высокий | Завершена | Маршрут /news/[id]; HTML-контент, инкремент просмотра |
| Рейтинг (5 звёзд) и комментарии (хронологический порядок) | Средний | Завершена | API rate и comments; отображение на публичной карточке при включённых настройках |
| Группы публикаций (каталог/рубрики) | Низкий | Отменена | Функционал удалён по решению: группы публикаций не использовались. Остаётся только каталог публикаций (новости/объявления) без рубрик. |

---

## Этап 9. Модуль «Рассылки» (план в docs/Mailings-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Модель данных (Mailing, MailingLog) | Высокий | Завершена | Prisma: internalTitle, тема, тело (HTML), отправитель, recipientConfig (JSON), режим (manual/scheduled), статус (planned/processing/completed), связь с User |
| API админки: CRUD рассылок, отправка «сейчас», копирование | Высокий | Завершена | GET list, POST create, GET/PATCH/DELETE [id], POST [id]/send, POST [id]/copy, GET [id]/logs; редактирование только при status=planned |
| Шаблонизация: ключевые слова %FirstName%, %LastName%, %date%, %unsubscribe% | Высокий | Завершена | Подстановка при отправке (renderMailingTemplate + wrapEmailHtml); %unsubscribe% — ссылка на /unsubscribe |
| Админ-интерфейс: каталог, форма с вкладками «Основное» и «Адресаты» | Высокий | Завершена | Таблица рассылок; форма (название, тема, тело, отправитель, режим, дата); адресаты: все / по роли / выбранные пользователи |
| Отправка и журнал: один раз на рассылку, MailingLog по каждому адресату | Высокий | Завершена | Статус sent/failed, errorMessage (в т.ч. «Не указан e-mail»); сводка и таблица в /portal/admin/mailings/[id] |
| Вложения: загрузка и контроль суммарного размера (например, макс. 10 МБ) | Средний | Завершена | POST/DELETE /api/portal/admin/mailings/[id]/attachments; хранение в uploads/mailings/[id]/; лимит 10 МБ; sendEmail с attachments; в форме при редактировании — список, добавление, удаление |
| Планировщик: отправка в указанное время (scheduled) | Средний | Завершена | GET /api/cron/mailings-send (защита CRON_SECRET); lib/mailing-send.ts runMailingSend; выбор рассылок scheduleMode=scheduled, status=planned, scheduledAt ≤ now; Vercel Cron или вызов по расписанию |
| Страница отписки от рассылок (/unsubscribe) | Средний | Завершена | Публичная страница /unsubscribe (форма email), POST /api/unsubscribe; модель MailingUnsubscribe; при отправке рассылки адреса из MailingUnsubscribe исключаются |

---

## Этап 10. Модуль «Уведомления» (план в docs/Notifications-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Шаблоны уведомлений (NotificationTemplate) и плейсхолдеры | Высокий | Завершена | Модель NotificationTemplate; плейсхолдеры; fallback из lib/email-templates |
| Функция triggerNotification(eventType, userId, metadata) | Высокий | Завершена | lib/notifications.ts: правило по eventType, шаблон, Notification + NotificationLog, email при type email/both |
| Журнал уведомлений для админки (NotificationLog) | Высокий | Завершена | Модель + API; страница «Журнал уведомлений» с фильтрами |
| Центр уведомлений: иконка прочитано/не прочитано, удаление | Средний | Завершена | Отметка прочитанным; DELETE уведомления; отображение subject из content |
| Админка: управление шаблонами и журнал | Высокий | Завершена | Журнал: /portal/admin/notification-logs. CRUD шаблонов: /portal/admin/notification-templates (список, новый, [id] — форма name, subject, body, type; API GET/POST/PATCH/DELETE). В карточке набора уведомлений — форма с выбором шаблона, isDefault, isActive (PATCH /api/portal/admin/notification-sets/[id]) |
| Перевод существующих событий на triggerNotification | Средний | Завершена | Запись на курс, сертификат, оплата — вызов triggerNotification |

---

## Этап 11. Модуль «Сертификаты» (доработка по плану docs/Certificates-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Шаблоны сертификатов в БД (CertificateTemplate) | Высокий | Завершена | CertificateTemplate (name, backgroundImageUrl, textMapping, courseId, minScore, requiredStatus, validityDays, numberingFormat, allowUserDownload); образы объединены с шаблонами. Certificate.templateId, expiryDate; миграция |
| Админка: CRUD шаблонов сертификатов | Высокий | Завершена | /portal/admin/certificate-templates (список, новый, [id]): форма с названием, загрузкой подложки (PNG/JPG/PDF), textMapping, курс, minScore, requiredStatus, validityDays, numberingFormat, allowUserDownload. API: GET/POST/PATCH/DELETE для templates (POST/PATCH поддерживают multipart с файлом подложки) |
| Логика checkCertificateEligibility и выдача по условиям | Высокий | Завершена | lib/certificates/eligibility.ts: checkCertificateEligibility(userId, courseId, courseScore?, courseStatus?), getTemplateForCourse; массовая выдача (generate) проверяет условия и выдаёт с templateId, expiryDate, numberingFormat; ручная выдача (issue) использует шаблон курса для срока и номера |
| Ручная выдача сертификата (модалка: пользователь + курс) | Высокий | Завершена | Certificate.expiryDate добавлено; POST /api/portal/admin/certificates/issue (userId, courseId, validityDays?); модалка «Выдать вручную»: поиск пользователя (/api/portal/manager/users/search), выбор курса, срок действия (дней); triggerNotification + аудит; при наличии шаблона курса — templateId, expiryDate, numberingFormat |
| Генерация PDF по шаблону (подложка + textMapping) | Средний | Завершена | При скачивании: если у сертификата есть шаблон с подложкой (template.backgroundImageUrl) — PDF по подложке и template.textMapping (name, date, courseTitle, certNumber); иначе — макет default/minimal/elegant. generateCertificatePdfWithImage в lib/certificates.tsx; оба маршрута download используют template.backgroundImageUrl и template.textMapping |
| Кнопка «Скачать» только при allowUserDownload | Средний | Завершена | В «Моих сертификатах» кнопка «Скачать PDF» только при allowDownload (из template.allowUserDownload); иначе текст «Электронная версия доступна только в реестре». API download — 403 для не-админа при allowUserDownload=false |
| Исправление генерации PDF: поддержка кириллицы (русские шрифты) | Высокий | Завершена | Подключён Noto Sans из @fontsource/noto-sans (локальный WOFF); Font.register по пути из node_modules; fallback на Helvetica при отсутствии файла. Исправлена ошибка 500 при скачивании (в Node загрузка по URL не работала) |

---

## Этап 12. Модуль «Отчётность» (план в docs/Reports-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| План и исследование стандартных отчётов LMS | Высокий | Завершена | docs/Reports-Plan.md: исследование iSpring, NetDimensions, Moodle; разрезы по пользователям, курсам, времени, сводка; таблица стандартных форм |
| API отчётов: summary, by-course, by-learner, by-period | Высокий | Завершена | GET /api/portal/admin/reports/summary, by-course, by-learner, by-period с фильтрами dateFrom, dateTo, status, role |
| Страница «Отчётность» в админке: формы, таблицы, экспорт CSV | Высокий | Завершена | Вкладки Сводка | По курсам | По слушателям | По периоду | Слушатели курса; период, фильтры; таблицы; экспорт CSV для всех типов |
| Детализация «Слушатели курса» с прогрессом | Средний | Завершена | GET /api/portal/admin/reports/course/[courseId]/learners; выбор курса, таблица: слушатель, зачислен, доступ, завершён, прогресс %, балл, время, сертификат |

---

## Этап 13. Модуль «Мониторинг» (план в docs/Monitoring-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| План модуля «Мониторинг» | Высокий | Завершена | docs/Monitoring-Plan.md: Пользователи Online, Статистика посещений (таблица + график), Выполняемые задачи; референс Mirapolis |
| Модель сессий/посещений и трекинг | Высокий | Завершена | VisitLog: loginAt, lastActivityAt, logoutAt, ipAddress, userAgent; lib/visits.ts, ping API, signOut → closeVisit; PingOnMount в PortalUIProvider |
| API: Пользователи Online | Высокий | Завершена | GET /api/portal/admin/monitoring/online — сводка по ролям, список активных сессий (ФИО, время входа, последний запрос, IP); поиск, пагинация |
| API: Статистика посещений | Высокий | Завершена | GET visits (период, таблица пользователь → кол-во сессий), GET visits/chart (год, месяц → уникальные посетители по дням), GET visits/user/[userId], POST visits/clear |
| Страница «Мониторинг»: вкладки Online и Посещения | Высокий | Завершена | Вкладки: Пользователи Online \| Посещения (Статистика + График). Таблицы, период, ссылки ФИО → /portal/admin/users/[id]. График: год/месяц, «Построить», гистограмма по дням |
| Детализация «Время посещения» по пользователю | Средний | Завершена | Страница /portal/admin/monitoring/visits/user/[userId]: список сессий (IP, вход, выход, User-Agent); период, кнопка Обновить |
| Выполняемые задачи: реестр и API | Средний | Завершена | lib/background-tasks.ts (in-memory), GET /api/portal/admin/monitoring/tasks, POST tasks/[taskId]/interrupt; интеграция в массовую выдачу сертификатов (registerTask, updateTaskProgress, isInterrupted, removeTask) |
| Очистка логов посещений | Средний | Завершена | Выбор «Очистить всё» / «Старше 30 дней» / «Старше 90 дней», кнопка «Очистить»; POST visits/clear с body olderThanDays |
| Автообновление списка Online (polling) | Низкий | Завершена | На вкладке «Пользователи Online» список обновляется каждые 60 сек (setInterval fetchOnline) |

---

## Иерархические группы (Курсы, Медиатека, Пользователи) — docs/Groups-Plan.md

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Модель Group, CourseGroup, MediaGroup, UserGroup; API групп и дерева | Высокий | Завершена | Prisma: Group (moduleType, parentId, type, accessType), связи многие-ко-многим; API CRUD групп, tree, назначение курсов/медиа/пользователей в группу |
| Интеграция в модуль «Курсы» | Высокий | Завершена | Сайдбар с деревом групп, фильтрация списка по группе; вкладка «Группы» в карточке курса |
| Интеграция в модуль «Медиатека» | Высокий | Завершена | Сайдбар с деревом групп, фильтрация по группе; в диалоге редактирования ресурса — блок «Группы ресурса»; API /api/portal/admin/media/[id]/groups |
| Интеграция в модуль «Пользователи» | Высокий | Завершена | Сайдбар с деревом групп, фильтрация по группе; вкладка «Группы» в карточке пользователя (роль участник/модератор); API /api/portal/admin/users/[id]/groups |
| Редактирование и удаление группы из дерева | Средний | Завершена | GroupTree: onEditGroup, onDeleteGroup; кнопки при наведении; ConfirmDialog при удалении; обновление дерева через treeVersion |

---

## Настройки оплаты PayKeeper в админке (план в docs/Payment-Settings-Plan.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| План и исследование настроек PayKeeper | Высокий | Завершена | docs/Payment-Settings-Plan.md: параметры подключения (сервер, логин, пароль, секрет), референс T-Bank/Tilda, поля для БД и UI |
| Хранение настроек PayKeeper в БД (шифрование секретов) | Высокий | Завершена | Ключи paykeeper_* в SystemSetting (category: payments); пароль и секрет шифруются при PATCH (lib/encrypt); fallback на env |
| API настроек: поддержка ключей PayKeeper в GET/PATCH | Высокий | Завершена | GET: paykeeper_password/secret только как флаги; PATCH: приём и шифрование; clearPayKeeperConfigCache после сохранения |
| lib/paykeeper: чтение конфига из БД с fallback на env | Высокий | Завершена | getPayKeeperConfigFromSettings(), кеш 2 мин; createPayKeeperInvoice и webhook используют конфиг из БД или env |
| Админка: карточка «Платежи (PayKeeper)» с формой | Высокий | Завершена | Форма: сервер, логин, пароль, секрет (пусто = не менять); подсказка URL уведомлений; ссылка на help.paykeeper.ru |

---

## Аудит пользовательского пути (план в docs/User-Journey-Audit.md)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Привязка оплаченных заказов при регистрации | Критический | Завершена | POST /api/auth/register: claimPaidOrdersForNewUser — enrollment + notification + Order.userId |
| Письмо клиенту «Заявка принята» (после формы контакта) | Высокий | Завершена | POST /api/contact: при указании email — письмо «Заявка принята» клиенту |
| Письмо при оплате тарифа без курса (консультация/тренинг) | Высокий | Завершена | Webhook PayKeeper: при отсутствии courseId — письмо «Оплата получена, свяжемся с вами» |
| Письмо при конвертации лида + ссылка «Установить пароль» | Высокий | Завершена | POST leads/convert: createPasswordToken, письмо со ссылкой /set-password?token=… |
| Страница «Установить пароль» по токену | Высокий | Завершена | Модель PasswordToken, GET /set-password?token=, POST /api/auth/set-password, форма пароля → редирект /login |
| Welcome-уведомление после регистрации | Средний | Завершена | eventType welcome в DEFAULT_NOTIFICATION_TEMPLATES; вызов triggerNotification после регистрации |
| Уведомление менеджеру и автоответ при создании тикета | Средний | Завершена | POST /api/portal/tickets: письмо студенту «Обращение принято», письмо на resend_notify_email о новом тикете |
| Персонализация страницы /success, привязка заказов при первом входе | Средний | Завершена | /success: для авторизованного — «Ваш курс/курсы уже в Мои курсы», название первого; portal layout: claimPaidOrdersForUser при входе студента; lib/claim-orders.ts |
| Сброс пароля по email (прод) | Средний | Завершена | /reset-password (форма email), POST /api/auth/forgot-password → письмо со ссылкой /set-password?token=…, «Забыли пароль?» на странице входа |
| Экран «Заявка отправлена» после формы контакта | Средний | Завершена | Contact.tsx: при status=sent — блок «Спасибо», CTA «Оплатить консультацию или курс», «Отправить ещё одну заявку» |
| Шаблоны писем об оплате в настройках (2.2) | Средний | Завершена | SystemSetting: email_payment_course_*, email_payment_generic_*; админка «Шаблоны писем об оплате»; webhook использует getPaymentEmailTemplates() |
| Онбординг-подсказка в ЛК студента (6.3) | Низкий | Завершена | StudentOnboardingHint на дашборде: подсказка «Мои курсы» / «Поддержка», кнопки, сокрытие по «Понятно» (localStorage) |
| Query order на /success (4.2) | Низкий | Завершена | /success?order=ORDER_NUMBER: для гостя показ «Заказ № … оплачен», маскированный email; редирект после оплаты с order в URL (payment create) |
| Шаблоны быстрых ответов для менеджера (7.3) | Низкий | Завершена | В TicketThread при canChangeStatus/canAssign — выпадающий список «Шаблон ответа» (доступ, «Мои курсы», уточняем, регистрация с email) |
| Связь Lead ↔ Order (1.3) | Низкий | Завершена | Поле Lead.lastOrderNumber; при оплате (webhook) обновление лидов с тем же email; в CRM — отображение «Оплаченный заказ» в карточке и в экспорте |
| Авто-тикет «Нет доступа после оплаты» (7.4) | Низкий | Завершена | При создании тикета: claim, затем поиск оплаченного заказа без доступа; Ticket.orderNumber, тема «Не приходит доступ»; в письме менеджеру и в интерфейсе тикета — заказ |

---

## Инфраструктура VPS (prod, 2026-06-14)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Прод-аудит VPS (фазы 0–6) | Высокий | Завершена | Deploy **239dd29**, systemd-only aletheia, fail2ban (3 jail), Mailcow mem limits, Docker log rotation, journald 500M (~2.9 GB freed), бэкап `/root/backups/20260614/`; скрипты `run-prod-audit.sh`, `prod-audit-remote.sh`; см. Production-Server.md §12, Diary 2026-06-14 |
| CRM: backfill лидов из заказов на проде | Высокий | Завершена | Root cause: `Lead` 0 rows; `scripts/backfill-leads-from-orders.ts`, `npm run db:backfill-leads-from-orders`; на проде восстановлено **7** лидов; commit **c4f5ed4**, Diary **f84ccfe** |
| Релиз 3.5.3 (SemVer PATCH) | Средний | Завершена | После аудита и CRM fix; CHANGELOG [3.5.3], Project.md, Tasktracker |
| Прод-почта: AUTHENTICATIONFAILED, Mailcow API | Высокий | Завершена | Root cause: `MAIL_PROVISIONING_MODE`/`MAILCOW_API_KEY` не заданы, таблица `api` в Mailcow пуста; fix: `setup-mailcow-api-prod.sh`, выравнивание info@/yarik@, `prod-inmail-sync-all-remote.sh` (4/4 OK); код ~**49a9ab6** (`verify-imap.ts`, retry в `domain-mailbox-service.ts`); E2E **`npm run mail:e2e-selfcheck`** PASS; Diary 2026-06-14, Mail-Server.md |

---

## Инфраструктура VPS (prod, 2026-06-15)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Telegram: миграция webhook → long-polling | Критический | Завершена | `lib/telegram-long-poll.ts`, `aletheia-telegram-poll.service`, deleteWebhook; причина — `Connection timed out` inbound webhook из РФ; offset `TELEGRAM_POLL_STATE_DIR`; Diary 2026-06-15 |
| Telegram Phase 1 UX (/about, FAQ, latency) | Высокий | Завершена | FAQ из DenisBot1 knowledge base; `/about` + кнопка «О школе»; кэш admin-check 30 с; `TELEGRAM_API_TIMEOUT_MS`; Diary 2026-06-15 |
| Деплой: systemd-only, rsync lib/app, poll worker | Высокий | Завершена | `deploy-rsync-from-local.sh`: build до stop, rsync `lib/`/`app/`, `pm2 delete aletheia`, restart poll worker; Production-Server.md §7 |
| SSL Let's Encrypt (сайт + mail) | Средний | Завершена | `avaterra.pro`/`www` и `mail.avaterra.pro` продлены **2026-06-15**, истекают **2026-09-13**; nginx reload; `/api/health` 200; Diary 2026-06-15 |
| Деплой 3.5.5 + рестарт aletheia-jobs | Высокий | Завершена | Коммит 48 файлов, rsync deploy, бэкап БД, fix deploy script (jobs restart), content integrity OK (7 ContentItem сохранены) |

---

## Дополнительные задачи

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Настройка .cursorrules и процесса разработки | Средний | Завершена | Правила в корне проекта |
| Ведение Diary.md | Низкий | В процессе | Регулярные записи решений и проблем |
| Перенос настроек из конфигов в меню админки (БД) | Высокий | Завершена | Редактируемые параметры (URL, email отправителя/получателя и т.п.) — в разделе «Настройки», хранение в БД (SystemSetting). Секреты в .env. План: docs/Plan-Settings-In-Admin.md |
| Оферта и политика конфиденциальности — контент | Средний | Завершена | Страницы /oferta и /privacy заполнены структурированным текстом (общие положения, предмет, порядок, оплата, ПД, заключение; политика ПД по разделам) |

---

## Этап 14. Модуль «Персональные товары» (Эпик 1)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Модели данных (PersonalProduct, PaymentLink) | Высокий | Завершена | Prisma: PersonalProduct (name, description, priceRub, expiresAt, isActive); PaymentLink (token, status, clientEmail/Name, orderId, PayKeeper поля). Миграция 20260627120000. |
| API CRUD персональных товаров | Высокий | Завершена | GET/POST `/api/portal/admin/personal-products`; GET/POST `/api/portal/admin/personal-products/[id]/links` (генерация ссылок с nanoid). |
| Публичная страница чекаута | Высокий | Завершена | `/pay/[token]` — минималистичный UI (логотип, название, цена, email/имя, кнопка «Оплатить»); TTL-контроль (expired → заглушка); статусы pending/paid/expired. |
| PayKeeper интеграция | Высокий | Завершена | POST `/api/pay/[token]/checkout` — создание Order + PayKeeper invoice (sum, orderid, clientid, service_name, client_email); редирект на success/fail. |
| Страницы success/fail | Средний | Завершена | `/pay/[token]/success` (чек отправлен), `/pay/[token]/fail` (повторить или на главную). |
| Админка: каталог товаров | Высокий | Завершена | `/portal/admin/personal-products` — таблица с пагинацией, поиск, создание, редактирование, дублирование, удаление (ConfirmDialog), AI-генерация описаний (5 пресетов + произвольный запрос). |
| Админка: детали товара + ссылки | Высокий | Завершена | `/portal/admin/personal-products/[id]` — информация о товаре, генерация ссылок (с email/именем), копирование в буфер, таблица ссылок со статусами. |
| Вебхук PayKeeper для PaymentLink | Высокий | Завершена | Обработка webhook: поиск PaymentLink по paykeeperInvoiceId, обновление статуса, Telegram админу + email клиенту при оплате. |
| Интеграция с CRM и Dashboard | Средний | Завершена | Авто-создание лида при оплате персонального товара; виджет «Персональные продажи» на дашборде. |
| Уведомления при оплате | Средний | Завершена | Telegram админу + email клиенту при оплате персональной ссылки. |

---

## Этап 15. Модуль «Рассрочка» (Эпик 2)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Модели данных (InstallmentPlan, InstallmentPayment) | Высокий | Завершена | Prisma: InstallmentPlan (orderId, totalParts, partAmountRub, status, nextPaymentAt); InstallmentPayment (partNumber, amountRub, status, scheduledAt). Связи с Order. |
| Логика создания рассрочки при checkout | Высокий | Завершена | POST `/api/portal/admin/installments` — создание Order + InstallmentPlan + N InstallmentPayment; первый платёж — немедленно через PayKeeper. |
| Cron ежедневных списаний | Высокий | Завершена | GET `/api/cron/installment-payments` (защита CRON_SECRET) — поиск scheduledAt ≤ now, создание PayKeeper invoice, обновление статусов. |
| Вебхук PayKeeper для рассрочки | Высокий | Завершена | Обработка webhook: orderid вида `ORDER-I1` → обновление InstallmentPayment, проверка всех платежей, автозавершение плана. |
| Вебхук PayKeeper для PaymentLink | Высокий | Завершена | Обновление PaymentLink.status → paid при оплате через webhook. |
| API управления рассрочками | Высокий | Завершена | GET/PATCH `/api/portal/admin/installments/[id]` — просмотр, смена статуса (completed/defaulted/cancelled). |
| Админка: каталог рассрочек | Высокий | Завершена | `/portal/admin/installments` — список с прогресс-баром, статусы, суммы. |
| Админка: детали рассрочки | Высокий | Завершена | `/portal/admin/installments/[id]` — график платежей, ручное управление статусом. |
| Уведомления по рассрочке | Средний | Завершена | `lib/installment-notify.ts`: Telegram (создание, платёж, завершена, ошибка, напоминание); email-чеки; email-напоминания за 3/1 день; cron auto-charge + reminders + overdue. |
| Документация для бухгалтера | Средний | Завершена | `PayKeeper-API-Map.md` — механизм рассрочки, cron, уведомления, финансовые риски (выручка, НДС, неполная оплата, возвраты). |

---

## Этап 16. Аудит ИБ и hardening (2026-07-10)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Обязательный CRON_SECRET | Критический | Завершена | `lib/cron-auth.ts`; без секрета → 503; VPS: `setup-cron-secret-prod.sh`, `/etc/cron.d/aletheia-http-cron`. |
| VPS: ufw, sshd, bind 127.0.0.1 | Критический | Завершена | `security-hardening-prod.sh`, `security-phase2-prod.sh`, `restore-ufw-prod.sh`; ufw 22/80/443 + Mailcow 25/587/993. |
| SCORM nginx auth_request | Высокий | Завершена | `GET /api/portal/scorm/access-check`; `apply-nginx-scorm-auth-prod.sh`. |
| Rate limits (login, unsubscribe, comments) | Высокий | Завершена | `lib/rate-limit.ts` + sweep; NextAuth credentials, `/api/unsubscribe`, publication comments. |
| PayKeeper: валидация суммы рассрочки | Высокий | Завершена | Webhook сверяет amount с `InstallmentPayment.amountRub`. |
| CSP, admin GET mask, health | Средний | Завершена | `next.config.mjs`; admin settings GET; SVG upload removed; `/api/health` без leak ошибок БД. |
| Fix login redirect после bind localhost | Критический | Завершена | `middleware.ts`, `lib/site-url.ts`, `app/auth/callback/route.ts`. |
| security-verify-prod.sh | Средний | Завершена | Read-only квартальный аудит; см. Production-Server.md §6.2, Support.md. |

---

## Этап 17. SEO / GEO-фундамент и индексация (16–24.07)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Публичная витрина товаров | Высокий | Завершена | `/services` и `/services/[slug]` (SSR из БД, Product+Offer JSON-LD, покупка через `PaymentModal`); общий источник `lib/shop/public-products.ts`; SSR тарифов на главной |
| llms.txt / llms-full.txt для ИИ-агентов | Средний | Завершена | Динамические маршруты с актуальными ценами, FAQ и блогом; robots.txt — явные allow для GPTBot, ClaudeBot, PerplexityBot, YandexAdditional и др. |
| Fail-safe sitemap и канонические URL | Высокий | Завершена | `app/sitemap.ts` не падает на Invalid Date/сбое БД (был риск HTTP 500), fallback-набор URL; убран корневой canonical из layout |
| Сущность школы и усиление /about | Средний | Завершена | `lib/seo/entity.ts` — каноническое определение для about / главной / llms.txt / JSON-LD; стратегия в docs/SEO.md |
| OG-баннер и favicon | Средний | Завершена | `public/images/og/og-default.png` 1200×630 (`scripts/generate-og-image.mjs`) вместо портретного; `scripts/generate-favicon.mjs` |
| Токен Google Search Console из админки | Средний | Завершена | Поле `google_site_verification` в SystemSettings — подтверждение GSC без деплоя; метатег в layout читает БД |
| SEO-заголовки статей | Средний | Завершена | 14 статей с title >65 символов исправлены (`scripts/blog-fix-seo-titles.ts`); автоимпорт из Telegram генерирует title/description через LLM (`lib/content/blog-seo-meta.ts`, сбой LLM не блокирует публикацию) |
| Яндекс.Метрика: расследование нулей | Высокий | Завершена | Причина найдена git-археологией: CSP `script-src 'self'` с 10.07 молча резала mc.yandex.ru. CSP исправлена, барьер согласия снят по решению владельца, баннер cookie — информационный |
| Блог: статьи из банка тем | Средний | Завершена | Статьи 20–41 под целевые запросы; банк тем `theme_bank` исчерпан (остаток — мета-принципы, не поисковые запросы) |

---

## Этап 18. Почта: доставляемость и контроль (13.07–15.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Исходящая почта Mailcow: DNS + изоляция | Критический | Завершена | SPF/DKIM/DMARC/PTR подтверждены, nft isolation; доставка на Gmail/Mail.ru проверена вживую (250 OK) |
| Ретрай IMAP на транзиентных сбоях | Средний | Завершена | `EAI_AGAIN` при синхронизации ящиков больше не даёт ложную тревогу «ошибок N из M» |
| Контроль отлупов | Высокий | Завершена | `scripts/mail-bounce-watch.sh` (cron 15 мин, Telegram-алерт); флаг `critical` в `sendTransactionalEmail` — алерт при сбое писем пароля/доступа |
| Уведомление о новых письмах в ящиках | Средний | Завершена | `scripts/mail-inbox-notify.py` (cron 10 мин) по admin/info/support/tatyana/yarik, кроме служебных. Нашло непрочитанное письмо клиента, лежавшее 5 дней |
| Google Postmaster Tools | Низкий | Заблокирована | Ждёт владельца: TXT-запись на корень домена в панели nic.ru — см. «Открытое» |

---

## Этап 19. Деплой и надёжность прода (11–15.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| CI-автодеплой из GitHub Actions | Критический | Завершена | Единый `deploy.yml`: сборка в Actions + rsync артефактов (без серверной сборки); секреты DEPLOY_*; push в main сам выкатывает прод. Опасный `build.yml` удалён |
| Near-zero-downtime деплой | Высокий | Завершена | `deploy-rsync-from-local.sh`: rsync источников и `.next` в staging при работающем приложении, окно = только swap+рестарт. Замер live-монитором: ~0,6 с (было ~40 с). `npm ci` только при смене package-lock, миграции — только неприменённые |
| Инцидент start-limit-hit | Критический | Завершена | Два быстрых push → 2 деплоя → systemd start-limit → прод 502 на ~6 мин. Фикс: `StartLimitIntervalSec=0` (drop-in + шаблон юнита); CI `paths-ignore` docs/**,*.md |
| Суточная самопроверка прода | Средний | Завершена | Тревога в Telegram при расхождении; проба `getMe` в суточном content-integrity |
| fail2ban на сканеров секретов | Высокий | Завершена | Сканер щупал /.git /.env /.aws под видом Googlebot (всё 404, утечки нет) — jail `nginx-secretscan` (nftables), idempotent в `scripts/security-hardening-prod.sh` |
| Blue-green деплой (истинный 0 с) | Низкий | Не начата | Дизайн готов (release-каталоги + flip nginx upstream, distDir запекается в сборку). Отложен 15.08: обычный деплой ужат до ~0,6 с, выигрыш не оправдывает сложности |

---

## Этап 20. Аналитика и Telegram-egress (12.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Постоянный egress для Telegram | Критический | Завершена | Прод 9 дней был без Telegram (умерла VPN-подписка). OpenConnect-VPN владельца: `openconnect-telegram.service`, userspace ocproxy SOCKS → gost 18080 → HTTPS_PROXY; маршруты сервера не тронуты, почта напрямую. Переустановка: `scripts/setup-openconnect-telegram.sh` |
| Почтовый дублёр алертов | Средний | Завершена | При полном отказе Telegram алерт уходит письмом (не чаще 1/час) |
| GA + Clarity включены | Средний | Завершена | Риск 152-ФЗ принят владельцем. CSP: googletagmanager.com, www.clarity.ms и **scripts.clarity.ms** (без последнего запись сессий молча резалась). Проверено живым браузером; политика ПДн и баннер cookie раскрывают иностранную аналитику |
| Промо Telegram-бота | Низкий | Завершена | `components/TelegramPromo.tsx` — конец статей блога, секция на главной, «Контакты», подвал, карточка в дашборде студента |

---

## Этап 21. Доступ студентов и онбординг (11–18.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Инцидент: оплаченный тариф показывал демоверсию | Критический | Завершена | В курсе лежал demo-SCORM, полный пакет — в другом курсе. Разобран триаж (VisitLog=вход, ScormProgress=открыл курс, EmailDeliveryLog) |
| Монитор целостности контента курсов | Высокий | Завершена | Суточная проверка + тревога в Telegram: расхождение SCORM/материалов курса не ждёт жалобы клиента |
| Напоминание «записались, но курс не открыли» | Средний | Завершена | `nudge-inactive-enrollees` + суточный cron |
| Онбординг-письма | Средний | Завершена | Упрощено письмо «установите пароль»; исправлено задваивание кавычек в названии курса |
| QA: бесплатная регистрация тестового пользователя | Низкий | Завершена | Регистрация на курс + письмо-инструкция для проверки пути студента |

---

## Этап 22. CRM и автономная воронка в @AvaterraProBot (24–27.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Лиды Telegram-бота попадают в CRM | Критический | Завершена | Две воронки шли мимо CRM; deep links → карточка лида, точка входа видна в карточке любого лида, диалог в Telegram виден там же |
| Квалификация, интент покупки, отписка | Высокий | Завершена | Автономная воронка, этап 1 |
| Прогрев в 3 касания и авто-оффер | Высокий | Завершена | Автономная воронка, этап 2; сводка воронки в дайджесте владельцу — этап 3 |
| Дожим после оффера и авто-закрытие | Высокий | Завершена | Плюс персонализация оффера и ответов под запрос лида |
| Учёт возражений и A/B формулировки оффера | Средний | Завершена | Понимание, почему не покупают; трекинг кликов по офферу — самый горячий сигнал для дожима |
| Контакт клиента без ручной обработки | Высокий | Завершена | Телефон в боте и передача из веб-чата; напоминание менеджеру о лидах, до которых бот не дотягивается |
| Автоответы по FAQ школы | Высокий | Завершена | Покрытие с 3 из 8 до 15 из 15; журнал вопросов без ответа и пробелы FAQ в дайджесте |
| AI-ответ на свободные вопросы | Средний | Завершена | По базе знаний, с защитой от инъекций; не дёргает LLM на многословных благодарностях |
| Лиды из бота партнёра | Средний | Завершена | Пересланное уведомление «Новый лид» → карточка CRM (`lib/telegram-bot/partner-lead.ts`); numeric id берётся из `tg://user?id`, сохраняется только при пересылке |
| Аудит воронки: 3 фикса | Высокий | Завершена | Реактивный оффер спамил (введён часовой пол); ложное возражение «развод»; вовлечённые-но-затихшие лиды нигде не всплывали |
| Аудит №2 (полный, независимый) | Критический | Завершена | 19/19 проверок чисто на копии прода: deep-link состязательно, подпись оффера от подделки, идемпотентность cron, дедупликация, устойчивость к мусору. Путь курса чист end-to-end |
| Находка №1: цены в FAQ бота | Высокий | Завершена | Суммы «Пробуждения» были захардкожены — риск расхождения с витриной; убраны, оставлена ссылка на тариф |
| Синхронизация баз знаний | Средний | Завершена | Тема «границы метода / когда нужен врач» проведена во все места разом: SEO-статья, FAQ-алиас бота, база AI-чата в БД прода, `avaterra.yaml` |
| Предохранитель тестов | Высокий | Завершена | Тесты слали реальные уведомления админам — закрыто предохранителем против реальной отправки |

---

## Этап 23. SMM-бот @AvaterraBot: перенос на прод (26.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Бот забран в репозиторий | Высокий | Завершена | Прод-версия ушла вперёд копии в `DenisBot1/` — забрана как источник истины (rsync без `.env`) |
| Перенос с 82.21.117.51 на 95.181.224.70 | Высокий | Завершена | Код, `.env`, дамп Postgres (16 таблиц) в `/opt/avaterra-bot`; старый экземпляр остановлен ДО запуска нового (один токен — иначе конфликт getUpdates), тома на старом хосте сохранены для отката |
| Egress для Telegram на РФ-хостинге | Критический | Завершена | aiogram/aiohttp не читает системный `HTTPS_PROXY` (trust_env=False) — прокси задаётся в коде (`TELEGRAM_PROXY`, нужен `aiohttp-socks`); контейнер в `network_mode: host` через серверный `docker-compose.override.yml` (в репозиторий не входит, исключён из rsync) |
| Разведение ролей ботов | Средний | Завершена | `FUNNEL_ENABLED=false`: @AvaterraBot — SMM (контент-план, генерация, публикация), воронку ведёт @AvaterraProBot; `/start` редиректит на бота портала |
| Дедупликация Telegram при недоступном каталоге | Низкий | Завершена | Не заваливает лог (на проде каталог доступен) |

---

## Этап 24. Яндекс.Вебмастер и внешние сигналы (30.08)

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Аудит трафика | Критический | Завершена | Вывод: органика ≈0, ИКС=0 — корень не в технической базе (она чиста), а во внешних сигналах. `docs/research/traffic-audit-2026-08-30.md` |
| Доступ к Вебмастеру закреплён в коде | Высокий | Завершена | Токен в `/opt/ALETHEIA/secrets/seo.env` (600, намеренно не в `.env` приложения); `lib/seo/yandex-webmaster.ts` — токен-лоадер, recrawlUrl, fetchWebmasterDigest |
| Переобход и диагностика | Высокий | Завершена | Переобход 59/59 URL принят; 52/59 страниц в поиске; закрыт BIG_FAVICON_ABSENT (квадратные favicon 120/180/512 — Яндекс не засчитывал логотип 640×628 с `sizes:any`) |
| Еженедельный SEO-дайджест | Средний | Завершена | Cron `/api/cron/yandex-webmaster-digest` (пн 09:00): ИКС, страницы в поиске, топ запросов, живая диагностика в Telegram + дострел переобхода статей за 8 дней. Публикация статей дёргает и IndexNow, и очередь Яндекса |
| Тематическая перелинковка блога | Средний | Завершена | Topical authority: связки между статьями одной темы |
| Пакет анонсов для Дзена | Средний | Завершена | 10 заготовок (`docs/marketing/dzen-announces.md`) + письмо и инструкция (`docs/marketing/dzen-instruction.md`). Публикует Татьяна, переписывая под свой голос |
| Каталоги и отзовики (упоминаний 0) | Высокий | Не начата | Zoon, Yell, 2GIS, otzovik, irecommend, подборки «курсы кинезиологии». Тексты готовлю я, регистрация — за владельцем (нужны ИНН/ОГРНИП) |
| Сдвиг деплоя из ночного пика краулинга | Низкий | Не начата | Деплои в 23:30–00:00 МСК дают 503 реальным ИИ-агентам; сдвинуть окно или вернуть атомарный выкат ~0,6 с |

---

## Открытое (на 2026-08-31)

**Ждёт владельца (разработкой не закрывается):**

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Ротация токена @AvaterraProBot | Критический | Заблокирована | Токен боевого бота с лидами и CRM засветился в переписке 26.08 — Revoke в BotFather и выдать новый |
| Доступ к Google Search Console | Высокий | Заблокирована | Без него нет ни диагностики Google, ни «Запросить индексирование». Яндекс.Вебмастер — доступ есть |
| Яндекс.Бизнес и каталоги | Высокий | Заблокирована | Нужны ИНН/ОГРНИП ИП + город. Главный рычаг роста при чистой технической базе |
| DNS TXT для Google Postmaster Tools | Средний | Заблокирована | TXT на корень в панели nic.ru (не трогая SPF) — мониторинг репутации домена в Gmail |
| PSI API-ключ / Resend | Низкий | Заблокирована | Еженедельный замер Core Web Vitals; альтернативный транспорт писем (код готов, `pickTransport`) |
| Противоречие блог↔оферта по возврату | Средний | Заблокирована | Блог обещает возврат 7 дней, оферта — «цифровой контент возврату может не подлежать». Владелец: «пока не трогать». При решении — привести в соответствие и добавить `hasMerchantReturnPolicy` в JsonLdProduct |

**Разработка:**

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Blue-green деплой | Низкий | Не начата | См. этап 19 — отложен осознанно |
| Сдвиг деплоя из ночного окна краулинга | Низкий | Не начата | См. этап 24 |
| Каталоги и отзовики: тексты | Высокий | Не начата | Единственная часть плана роста, которую можно двигать без владельца |
| SMM-бот, спринт 6 | Низкий | Не начата | Ранжирование тем по эффективности, A/B вариаций CTA, коррекция контент-политики. Ждал 2–4 недели данных — накоплены. `DenisBot1/docs/Tasktracker.md` |
| SMM-бот: автосбор views/reactions | Низкий | Не начата | Требует MTProto-аккаунта |
| Режим публикации SMM-бота | Средний | Не начата | Сейчас `PUBLISH_MODE=admin_preview` — пост уходит на утверждение админам, в канал сам не публикуется. Переключение на автопостинг — решение владельца, а не задача |
| Мультиязычность, масштаб каталога курсов | Низкий | Не начата | Из [Backlog-Optional.md](Backlog-Optional.md), ждёт решения заказчика |

---

*Новые задачи добавлять в соответствующий этап с указанием приоритета. При выполнении менять статус на «В процессе» / «Завершена».*
