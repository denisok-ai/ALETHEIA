# Трекер задач AVATERRA

Отслеживание прогресса разработки. Основа — этапы и требования из `docs/Project.md`.

**Версия:** 3.0 (портал, роли, SCORM, сертификаты, коммуникации).  
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
| Telegram webhook, lib/telegram, lib/email, lib/audit | Средний | Завершена | Команды /start, /progress, /cert, /help |
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

---

## Этап 1. Уточнение и дизайн

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
| Уведомления (email/мессенджеры) | Средний | Завершена | Resend в /api/contact; Telegram webhook; notifications в БД |

---

## Этап 5. Контент и SEO

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Финальные тексты и медиа | Высокий | Завершена | Тексты в docs/Content.md; медиа: фото Татьяны с прототипа, остальное по docs/Media.md |
| Мета-теги и базовое SEO | Средний | Завершена | title, description, Open Graph, metadataBase, robots в layout.tsx |
| Метаданные и sitemap/robots | Средний | Завершена | metadata для /oferta, /privacy; app/sitemap.ts, app/robots.ts (публичные пути, disallow /portal/, /api/, /auth/) |
| Оптимизация загрузки (изображения, ресурсы) | Средний | Завершена | next/image для логотипа, курсов |

---

## Этап 6. Запуск и поддержка

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Подготовка к релизу (CHANGELOG, чек-лист, predeploy) | Высокий | Завершена | CHANGELOG дополнен; Deploy.md — чек-лист, проверка после деплоя; npm run predeploy (lint+build) |
| Деплой на прод | Критический | В процессе | Vercel + GitHub или VPS (docs/Deploy.md). predeploy проходит; после коммита и настройки env/БД на сервере — тег v3.0.0 и push |
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

## Дополнительные задачи

| Задача | Приоритет | Статус | Описание |
|--------|-----------|--------|----------|
| Настройка .cursorrules и процесса разработки | Средний | Завершена | Правила в корне проекта |
| Ведение Diary.md | Низкий | В процессе | Регулярные записи решений и проблем |
| Перенос настроек из конфигов в меню админки (БД) | Высокий | Завершена | Редактируемые параметры (URL, email отправителя/получателя и т.п.) — в разделе «Настройки», хранение в БД (SystemSetting). Секреты в .env. План: docs/Plan-Settings-In-Admin.md |
| Оферта и политика конфиденциальности — контент | Средний | Завершена | Страницы /oferta и /privacy заполнены структурированным текстом (общие положения, предмет, порядок, оплата, ПД, заключение; политика ПД по разделам) |

---

*Новые задачи добавлять в соответствующий этап с указанием приоритета. При выполнении менять статус на «В процессе» / «Завершена».*
