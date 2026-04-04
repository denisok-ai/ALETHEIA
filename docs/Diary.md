# Дневник проекта AVATERRA

Подробный дневник наблюдений: технические решения, проблемы и их решения. Обеспечивает преемственность для разных разработчиков.

## 2026-04-01 — Документация прода: VPS, деплой, nginx, сборка

**Задача:** зафиксировать конфигурацию продуктивного сервера (`95.181.224.70`, `/opt/ALETHEIA`, https://avaterra.pro), порядок обновления (Git + `deploy-pull.sh` и альтернатива `npm run deploy:rsync` с WSL), риски `proxy_cache`, systemd vs PM2, исправления вокруг `instrumentation` / `crypto` / портальных layout.

**Сделано:** переработан единый документ [Production-Server.md](Production-Server.md) (идентификация, Node/systemd, nginx, SSL, Prisma, таблица изменений в коде, пошаговые сценарии деплоя, конфликты git, проверки, диагностика, ссылки на скрипты).

---

## 2026-03-22 — Админка оплат: UX блока «Товары для главной»

**Задача:** привести экран управления услугами к паттерну с соседнего проекта (Neurocosmetics): форма создания/редактирования в `portal-card` над таблицей, без многошагового мастера в модалке.

**Сделано:** в `ServicesAdminBlock` — поиск, фильтр по активности, пагинация (`TablePagination`), колонка «Статус»; форма «Новый товар» / «Редактировать товар» с кнопкой «Закрыть»; строка поиска и фильтра вынесена под заголовок карточки для узких экранов.

**Файлы:** `app/portal/admin/payments/ServicesAdminBlock.tsx`, `docs/Support.md`, e2e в `tests/e2e/admin/all-sections.spec.ts`.

---

## 2026-03-22 — Медиатека: просмотр PDF/видео/изображений и UI админки

**Задача:** единый просмотрщик в портале (студент и админ-превью), постраничный PDF с масштабом, современное видео, зум изображений; карточки с обложкой `thumbnailUrl`; админ — сетка и поиск по описанию.

**Решение:**
1. **PDF:** `react-pdf` + PDF.js, worker через CDN `unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs` (в модуле `MediaPdfPanel`, как рекомендует react-pdf). В `next.config.mjs` добавлен `transpilePackages: ['react-pdf']`; для клиентского бандла в **dev** — `cheap-module-source-map` (см. запись 2026-03-23).
2. **Видео:** **Plyr** (вместо Vidstack: в npm для `@vidstack/react` актуальна только линейка 0.6.x с иным API). Plyr даёт скорость, PiP, полноэкранный режим, клавиатурные подсказки.
3. **Изображения:** `react-zoom-pan-pinch` (колесо, pinch, двойной клик сброс).
4. **Общий компонент:** `components/portal/media/MediaViewer.tsx` + ленивая обёртка `MediaViewerLazy.tsx` (`dynamic`, `ssr: false`).
5. **API:** `GET /api/portal/media/[id]/view` дополнен полем `thumbnail_url` для постера видео после инкремента просмотров.
6. **Админ:** переключатель таблица/сетка (сохранение в `localStorage` `portal-media-admin-view`), колонка «Описание», поиск по названию/описанию/категории.
7. **Студент:** в списке медиатеки отображается `thumbnailUrl` при наличии.

**Риски:** внешние `fileUrl` с другого origin без CORS могут не открываться в PDF.js; worker зависит от доступности unpkg (при необходимости скопировать `pdf.worker.min.mjs` в `public/`).

**Файлы:** `components/portal/media/*`, `lib/media-mime.ts`, `app/portal/student/media/*`, `app/portal/admin/media/MediaAdminClient.tsx`, `app/api/portal/media/[id]/view/route.ts`, `next.config.mjs`.

---

## 2026-03-23 — Медиатека: снята debug-инструментализация

**Задача:** убрать временные `fetch` на локальный ingest и файл `media-pdf-trace.ts` после отладки PDF в `next dev`.

**Сохранено:** в `next.config.mjs` для `dev && !isServer` остаётся `devtool: 'cheap-module-source-map'` — обход падения `pdfjs-dist` при стандартном `eval-source-map` (mozilla/pdf.js#20478).

**Файлы:** удалён `components/portal/media/media-pdf-trace.ts`; правки `MediaPdfPanel.tsx`, `MediaViewer.tsx`.

**Доп. 2026-03-23:** если `cheap-module-source-map` не устраняет падение pdf.mjs в dev, для клиента задан `devtool: 'source-map'`. Превью в админке: `DialogContent` без `overflow-auto` на всём блоке — внутренний скролл, чтобы не ломать UI Plyr.

**Доп. 2026-03-23 (PDF):** `react-pdf`/`pdfjs-dist` убраны из просмотра медиатеки — превью PDF через `<iframe>` и встроенный просмотрщик браузера (страницы/зум). Иначе в Next dev webpack оборачивает вложенный бандл pdf.js в `eval` и падает с `Object.defineProperty`. Сертификаты не затронуты (`@react-pdf/renderer` — отдельный пакет).

---

## 2026-03-15 — Исправление падающих E2E-тестов

**Задача:** устранить падения guest-тестов после доработок.

**Исправления:**
1. **Навигация главной:** селекторы приведены к фактическим ссылкам (Тарифы, FAQ, #contact). Проверка #contact вместо ссылки «Запишись».
2. **Модалка покупки:** ожидание анимации useInView (800ms), селектор `#pricing` для кнопки «Купить», scope dialog для полей (избежание strict mode).
3. **Новости:** `article.first()` вместо `main, article` (strict mode).
4. **Валидация логина:** regex `/неверный email|ошибка входа/i` для сообщения об ошибке.
5. **Логин:** опрос getSession до 5 сек, `window.location.href` для редиректа, порядок тестов (student → manager → admin) для прогрева сервера.
6. **Playwright:** workers: 1, fullyParallel: false для стабильности с SQLite; timeout auth setup 15 сек.

**Файлы:** tests/e2e/guest/public-pages.spec.ts, tests/e2e/guest/auth-login-redirect.spec.ts, app/(auth)/login/page.tsx, playwright.config.ts, tests/e2e/auth.setup.ts.

---

## 2026-03-15 — Доработка автотестов (E2E)

**Задача:** расширить E2E-тесты по плану доработок.

**Добавленные тесты:**
1. `guest/auth-login-redirect.spec.ts` — редирект после логина по роли (admin → /portal/admin/dashboard, manager → /portal/manager/dashboard, student → /portal/student/dashboard).
2. `guest/public-pages.spec.ts` — валидация формы заявки (пустая форма не отправляется), валидация логина (неверный пароль → сообщение).
3. `student/dashboard.spec.ts` — клик по ссылке курса ведёт на страницу курса.
4. `cross-role/scorm-seed-content.spec.ts` — студент открывает плеер с контентом из seed (course-seed-1) без загрузки ZIP.

**Файлы:** tests/e2e/guest/auth-login-redirect.spec.ts (новый), tests/e2e/guest/public-pages.spec.ts, tests/e2e/student/dashboard.spec.ts, tests/e2e/cross-role/scorm-seed-content.spec.ts (новый), docs/Testing-Improvement-Plan.md.

---

## 2026-03-15 — SCORM-контент для тестовых курсов

**Задача:** docs/Browser-Test-Remediation-Plan.md — добавить минимальный SCORM для демо.

**Решение:** В prisma/seed.ts после обновления курсов (scormPath, scormManifest) добавлено создание HTML-файлов для course-seed-1 и course-seed-2: index.html, lesson1.html, lesson2.html, lesson3.html в `public/uploads/scorm/courses-{id}/`. Минимальный контент (заголовок + текст) совместим с scorm-again. После `npx prisma db seed` плеер показывает 3 урока без загрузки ZIP.

**Файлы:** prisma/seed.ts, docs/Support.md, docs/Browser-Test-Remediation-Plan.md.

---

## 2026-03-15 — Доработки по плану тестирования (Browser-Test-Remediation-Plan)

**Задача:** реализовать пункты из docs/Browser-Test-Remediation-Plan.md.

**1. 404 на /portal при первом редиректе:** Исправлено. После signIn вызывается getSession(), по роли определяется дашборд (admin/manager/student), редирект идёт сразу на `/portal/*/dashboard`, минуя `/portal`. Файл: app/(auth)/login/page.tsx.

**2. Редирект signOut:** Проверено — PortalHeader, PortalAccountBlock, signout используют `callbackUrl: window.location.origin + '/login'`. Редирект остаётся на текущем хосте/порту.

**3. Клик по карточке курса:** Исправлено. Overlay с play-кнопкой имел `inset-0` и перехватывал все клики. Добавлен `pointer-events-none` на overlay и `pointer-events-auto` на кнопку — клики по обложке проходят к cover div (переход на страницу курса), клики по кнопке — на плеер. Файл: components/portal/CourseCard.tsx.

**4. SCORM:** В docs/Support.md добавлен раздел «Проверка SCORM-плеера» — как загрузить контент, какие курсы использовать.

**Файлы:** app/(auth)/login/page.tsx, components/portal/CourseCard.tsx, docs/Support.md, docs/Browser-Test-Remediation-Plan.md.

---

## 2026-03-15 — Браузерное тестирование и план доработки

**Задача:** полное тестирование сайта на http://localhost:3001 под всеми ролями (гость, студент, менеджер, админ).

**Выполнено:** автоматизированное тестирование через browser MCP. Проверены: публичные страницы, модалка покупки, форма контактов, FAQ, логин, ЛК студента (дашборд, курсы, поддержка, тикеты), кабинет менеджера (тикеты, пользователи, верификация), админка (дашборд, курсы, пользователи, CRM, оплаты, медиа, рассылки, настройки). Сквозной сценарий: студент создал тикет → тикет отображается у менеджера. Защита /portal без авторизации — редирект на логин.

**Результаты:** отчёт `docs/Browser-Test-Report-2025-03-15.md`, план доработки `docs/Browser-Test-Remediation-Plan.md`.

**Найденные проблемы:** 404 на /portal при первом редиректе студента; редирект signOut на другой порт (проверить callbackUrl); SCORM-плеер без контента для части курсов; клик по карточке курса не всегда срабатывает.

---

## 2026-03-15 — Исправление сборки (MODULE_NOT_FOUND) и продолжение плана

**Задача:** устранить ошибку `npm run build` (MODULE_NOT_FOUND ./1682.js), выполнить оставшиеся пункты плана.

**Build:**
- Ошибка возникала при «грязном» кэше .next (частичная пересборка). Решение: `rm -rf .next && npm run build` или `npm run build:clean`.
- В `app/api/auth/[...nextauth]/route.ts` добавлен `export const dynamic = 'force-dynamic'` — улучшает стабильность сбора страниц.
- Сборка проходит успешно.

**План (Testing-Improvement-Plan):**
- Задача 5 (data-cursor-ref): отмечена выполненной — production-сборка работает.
- Задача 8 (NEXTAUTH_URL): дополнена инструкциями в плане.
- Задача 9 (админ-настройки): добавлен чек-лист для ручной проверки.
- Чек-лист релиза: build отмечен выполненным.

**Файлы:** app/api/auth/[...nextauth]/route.ts, docs/Testing-Improvement-Plan.md.

---

## 2026-03-15 — Обновление плана доработок (Testing-Improvement-Plan)

**Задача:** отметить выполненные пункты плана, актуализировать чек-лист.

**Изменения в docs/Testing-Improvement-Plan.md:**
- Задачи 2, 3, 4, 6, 7 — статус «выполнено» (чат, toast PayKeeper, валидация, контакты, документация ID публикаций).
- Чек-лист: отмечены выполненные пункты (модалка, контакты, валидация, E2E).
- Оставшиеся: чат (настройка ключа), build (MODULE_NOT_FOUND), консоль, data-cursor-ref, NEXTAUTH_URL.

**Изменения в .env.example:**
- Добавлен комментарий про DEEPSEEK_API_KEY для чат-бота: где задать ключ и что показывается без него.

**Файлы:** docs/Testing-Improvement-Plan.md, .env.example.

---

## 2026-03-15 — Исправление ошибки Cookies в PortalLayout

**Задача:** продолжить по docs/Testing-Improvement-Plan.md. Ошибка «Cookies can only be modified in a Server Action or Route Handler» при claim orders в app/portal/layout.tsx.

**Решение:** Логика привязки заказов вынесена в Route Handler `GET /api/portal/claim-orders`. Layout больше не вызывает `cookies().set()`. Добавлен клиентский компонент `ClaimOrdersTrigger`, который при входе студента в портал вызывает API; API проверяет cookie, при отсутствии выполняет claim и устанавливает cookie в ответе. Частота ограничена 1 раз в день (cookie avaterra_claim_checked).

**Файлы:** app/api/portal/claim-orders/route.ts (новый), components/portal/ClaimOrdersTrigger.tsx (новый), app/portal/layout.tsx.

---

## 2026-03-15 — Унификация контактов и документация

**Задача:** продолжить разработку по docs/Testing-Improvement-Plan.md.

**Унификация контактов (телефон):** Секция Contact на главной использовала хардкод +7 (495) 123-45-67, тогда как Footer и seed — +7 (999) 123-45-67 из SystemSetting.contact_phone. Исправлено: app/page.tsx получает settings через getSystemSettings(), передаёт contactPhone в Contact; Contact принимает проп contactPhone и использует его (fallback +7 (495) 123-45-67). Теперь блок «Оставьте заявку» и футер показывают один номер из настроек.

**Документация ID публикаций:** В docs/Support.md добавлен раздел «Новости и публикации» — указано, что ID строковые (nanoid), пример ссылки, пояснение про /news/1 → 404.

**Чат-бот:** API уже поддерживает гостей (без 401), rate limit 5 req для гостей vs 10 для авторизованных. Сообщение 503: «Настройте API-ключ в Настройки AI» — уже информативно.

**PaymentModal:** Обработка ошибок и toast уже реализованы (A.1 в Diary). При ошибке PayKeeper API возвращает «Ошибка создания платежа. Проверьте настройки PayKeeper.» — клиент отображает через data?.error.

**Файлы:** app/page.tsx, components/sections/Contact.tsx, docs/Support.md.

---

## 2026-03-15 — Доработки по плану тестирования (авторежим)

**Задача:** реализовать пункты из docs/Testing-Improvement-Plan.md по результатам комплексного browser-тестирования.

**A.1 Ошибка при неудачном создании платежа:** PaymentModal — заменён alert на toast.error; добавлена обработка ошибок сети и невалидного JSON; сообщения «Не удалось создать платёж. Попробуйте позже или свяжитесь с нами», «Ошибка сети. Проверьте подключение…».

**A.2 Подсказка на /success:** для гостя с orderInfo — выделенный блок (border, bg) с текстом «Чтобы получить доступ к курсу, зарегистрируйтесь с тем же email…».

**B.1 Сообщение после регистрации:** register → redirect на `/login?registered=1`; на странице входа — зелёный блок «Аккаунт создан. Войдите, используя email и пароль.»

**C.2 Пагинация тикетов студента:** SupportTicketsClient — размер страницы 10/25/50, навигация «Предыдущая/Следующая», счётчик «Страница X из Y», счётчик обращений. При создании нового тикета — сброс на страницу 0.

**Seed-данные:** уведомления — разнообразные типы (enrollment, certificate_issued, system, mailing, access_opened) и заголовки; тикеты — доп. 2 тикета на каждого из первых 20 студентов с разными темами; публикации — уникальные заголовки (Новость №1, Анонс №2, Итоги №3…); опечатка «Тело не врем» — в конце seed блок updateMany для исправления в существующих курсах.

**Продолжение (оставшиеся пункты плана):**
- **Витрина 4+ сервисов:** в seed добавлены 4 основных тарифа (consult, group, course, online) с paykeeperTariffId и привязкой к опубликованному курсу; upsert по slug.
- **Валидация paykeeperTariffId:** в ServicesAdminBlock — предупреждение при courseId без paykeeperTariffId; блокировка submit.
- **Страница signout (русский):** app/signout/page.tsx с текстом «Выход», «Вы уверены?», кнопками «Выйти»/«Остаться»; lib/auth.ts pages.signOut: '/signout'.

**Файлы:** components/PaymentModal.tsx, app/success/page.tsx, app/(auth)/register/page.tsx, app/(auth)/login/page.tsx, app/portal/student/support/SupportTicketsClient.tsx, prisma/seed.ts, app/portal/admin/payments/ServicesAdminBlock.tsx, app/signout/page.tsx, lib/auth.ts, docs/Testing-Improvement-Plan.md.

---

## 2026-03-15 — Устранение замечаний по тестированию UI

**Задача:** устранить замечания из docs/Testing-Improvement-Plan.md по результатам тестирования MCP browser.

**Редирект при выходе:** signOut вызывался с `callbackUrl: '/login'`, NextAuth использовал NEXTAUTH_URL (часто localhost:3000), из-за чего при работе на порту 3001 редирект уводил на 3000. Исправлено: в PortalHeader, PortalAccountBlock, verify-email-required передаётся `callbackUrl: window.location.origin + '/login'` — выход остаётся на текущем порту.

**Уведомления — типы вместо сырого «mailing»:** добавлена `formatNotificationType()` в lib/notification-content.ts с маппингом (mailing→Рассылка, enrollment→Запись на курс и т.д.). На дашборде студента: заголовок — formatNotificationContent (или type label), подзаголовок — type label при наличии контента. В NotificationsList — type выводится через formatNotificationType.

**Опечатка «проходеним» в тикетах:** в prisma/seed.ts добавлена тема «Проблема с прохождением курса» (правильное написание) в ticketSubjects. Новые seed-данные будут корректны.

**Файлы:** lib/notification-content.ts, app/portal/student/dashboard/page.tsx, app/portal/student/notifications/NotificationsList.tsx, components/portal/PortalHeader.tsx, components/portal/PortalAccountBlock.tsx, app/verify-email-required/page.tsx, prisma/seed.ts, .env.example (комментарий NEXTAUTH_URL).

**Продолжение:** Обновлена заметка в docs/Testing-Improvement-Plan.md (редирект при выходе исправлен). Выполнен `npx prisma db seed` — БД обновлена с новой темой тикетов «Проблема с прохождением курса». `npm run predeploy` проходит успешно.

---

## 2026-03-13 — План доработок портала (Portal improvements plan)

**Задача:** реализовать план доработок портала — безопасность, баги UI/UX, навигация между ролями.

**Безопасность:** Сертификаты — фильтр `revokedAt: null` в списке студента и в API download (отозванные не показываются и не скачиваются). Страницы менеджера — добавлена проверка роли `notFound()` в verifications, tickets, dashboard (defense-in-depth). Media-access — задокументировано: медиа без courseId и mediaGroups доступны любому авторизованному. Verifications/upload — проверка наличия enrollment (или admin) перед загрузкой.

**Баги UI:** Ссылки на тикеты в UserDetailTabs (admin users/[id]) — исправлено на `/portal/manager/tickets/${t.id}`. VerificationsList — менеджерам ссылка `/portal/manager/users`, админам `/portal/admin/users`. PortalHeader — убраны невалидные `h-4.5 w-4.5`. PortalUIProvider — удалён дублирующий MobileMenuBar. UsersTable — реализована column visibility (columnVisibility в useReactTable). TicketThread — при смене менеджера используется `currentManagerDisplayName` из managers.

**Навигация и UX:** Ссылки на пользователей в ManagerTicketsTableClient. В карточке пользователя менеджера — ссылки на курсы и сертификаты (для админа — скачать). Хардкод цветов заменён на CSS-переменные (TicketThread, HelpContent, TablePagination). Добавлен loading.tsx для SCORM player. Profile page — Promise.all для profile и user. Реальный счётчик непрочитанных уведомлений в header (студенты). TablePagination — «Нет записей» при totalPages === 0. UsersTable — локализованные роли (Студент, Менеджер, Администратор).

**Верификация:** Проверены flow claim-orders, set-password, welcome, тикеты, сброс пароля — все реализованы. Admin/manager bypass в SCORM API подтверждён.

**Файлы:** app/portal/student/certificates/page.tsx, app/api/portal/certificates/[certId]/download/route.ts, app/portal/manager/*, lib/media-access.ts, app/api/portal/verifications/upload/route.ts, app/portal/admin/users/[id]/UserDetailTabs.tsx, VerificationsList.tsx, PortalHeader.tsx, PortalUIProvider.tsx, UsersTable.tsx, TicketThread.tsx, ManagerTicketsTableClient.tsx, app/portal/manager/users/[id]/page.tsx, HelpContent.tsx, TablePagination.tsx, app/portal/student/profile/page.tsx, app/portal/layout.tsx, app/portal/student/courses/[courseId]/play/loading.tsx.

---

## 2026-03-18 — Доработки: тикеты, верификация, загрузка видео, база знаний

**Тикеты:** при ответе менеджера в тикете (POST `/api/portal/tickets/[id]/messages` с ролью manager) студенту отправляется email «В вашем обращении появился новый ответ» с текстом ответа и ссылкой на обращение.

**База знаний из тикетов:** для админа на странице тикета (менеджер/админ) при статусе «Решён» или «Закрыт» отображается блок «Добавить в базу типовых ответов». Тема, первый вопрос пользователя и последний ответ менеджера подставляются в текст; админ может отредактировать и отправить. API `POST /api/portal/admin/ai-settings/knowledge-base/append` дополняет текущую базу знаний фрагментом (используется в suggest-reply и чат-боте). Компонент: TicketThread (prop `canAddToKb`), страница тикета передаёт `canAddToKb={role === 'admin'}`.

**Автоответ при создании тикета:** в Настройки AI добавлен блок «Автоответ при создании обращения» (чекбокс). При включённой настройке `ticket_auto_reply_enabled` после создания тикета вызывается LLM (lib/ticket-auto-reply.ts) по теме и первому сообщению с учётом базы знаний. Если ответ считается «уверенным» (нет дискалеймеров вроде «не уверен», «обратитесь к менеджеру»), он сохраняется как первое сообщение от менеджера и студенту отправляется email с ответом. API: GET/PATCH `/api/portal/admin/ai-settings/ticket-auto-reply`; компонент TicketAutoReplyBlock.

**Отчётность: экспорт в XLSX.** На странице «Отчётность» добавлена кнопка «XLSX» рядом с «CSV»; выгрузка текущего отчёта (сводка, по курсам, по слушателям, по периоду, слушатели курса) через lib/export-xlsx (downloadXlsxFromArrays). CHANGELOG [Unreleased] дополнен записью о тикетах (автоответ, добавление в БЗ), верификации (загрузка видео), экспорте XLSX.

**Верификация и сертификат:** при авто-выдаче и массовой выдаче сертификатов учитываются уроки с обязательной верификацией (`Course.verificationRequiredLessonIds`): сертификат выдаётся только если по каждому такому уроку есть одобренная запись `PhygitalVerification` (app/api/portal/scorm/progress/route.ts — maybeIssueCertificate; app/api/portal/admin/certificates/generate/route.ts).

**Загрузка видео для верификации:** добавлен API `POST /api/portal/verifications/upload` (студент, видео до 200 МБ, сохранение в `public/uploads/verifications/`). На странице «Задания на проверку» и в блоке «Задания на проверку» на странице курса — кнопка «Загрузить видео»; в форме редактирования задания (pending) — тоже. API создания/редактирования верификации принимает URL вида `/uploads/...` в дополнение к http/https.

**Единая пагинация таблиц:** во всех таблицах портала (Медиатека, Курсы, Пользователи, Оплаты, CRM, Аудит, Сертификаты, Коммуникации, Рассылки, Мониторинг, Тикеты менеджера и др.) пагинация приведена к одному виду: экспорт константы `STANDARD_PAGE_SIZES = [10, 25, 50, 100]` из `components/ui/TablePagination.tsx`, везде используются одни и те же кнопки размера страницы и блок «Записи X–Y из Z» + навигация. На странице «Курсы» убрана обёртка IIFE вокруг TablePagination. Tasktracker (Фаза 3) обновлён.

**Лог запросов к AI:** на странице Настройки AI блок «Лог запросов к AI» реализован. In-memory хранилище (lib/llm-request-log.ts, до 100 записей), API GET /api/portal/admin/ai-settings/request-log (админ). В лог пишутся вызовы: чат-бот, подсказка ответа в тикете, автоответ при создании тикета, генерация текста (generate-text), генерация промпта (prompt-templates/generate). Компонент LlmRequestLogBlock выводит таблицу (дата, сценарий, модель, символы, время, роль). Лог сбрасывается при перезапуске процесса. Файлы: lib/llm-request-log.ts, app/api/portal/admin/ai-settings/request-log/route.ts, app/portal/admin/ai-settings/LlmRequestLogBlock.tsx, app/portal/admin/ai-settings/page.tsx, app/api/chat/route.ts, app/api/portal/tickets/[id]/suggest-reply/route.ts, lib/ticket-auto-reply.ts, app/api/portal/admin/ai-settings/generate-text/route.ts, app/api/portal/admin/ai-settings/prompt-templates/generate/route.ts.

**Файлы:** app/api/portal/tickets/[id]/messages/route.ts, app/api/portal/admin/ai-settings/knowledge-base/append/route.ts, components/portal/TicketThread.tsx, app/portal/manager/tickets/[id]/page.tsx, app/api/portal/scorm/progress/route.ts, app/api/portal/admin/certificates/generate/route.ts, app/api/portal/verifications/upload/route.ts, app/api/portal/verifications/route.ts, app/api/portal/verifications/[id]/route.ts, app/portal/student/verifications/VerificationsPageClient.tsx, app/portal/student/courses/[courseId]/CourseVerificationBlock.tsx, docs/Verification-Module.md, docs/Support-Tickets-Audit.md; components/ui/TablePagination.tsx, все клиенты таблиц (Media, Courses, UsersTable, Payments, CRM, Audit, Certificates, Communications, Mailings, Monitoring, ManagerTickets и др.), docs/Tasktracker.md.

---

## 2026-03-12 — Тестовые данные в seed (сертификаты, прогресс, прочее)

**Задача:** добавить тестовые данные для проверки функционала сертификатов, прогресса прохождения курсов и недостающих сущностей.

**Изменения в prisma/seed.ts:**
- **Курсы:** для первых 5 опубликованных курсов заданы `scormPath`, `scormVersion`, `scormManifest` (JSON с уроками `lesson-1`, `lesson-2`, `lesson-3`) — для проверки плеера и прогресса.
- **Сертификаты:** 50+ записей с уникальными парами (userId, courseId), номер в формате `ALT-XXXXXXXX`, привязка к разным шаблонам; у части указан истёкший `expiryDate` для проверки отображения.
- **ScormProgress:** для всех записей на опубликованные курсы добавлен прогресс по урокам `lesson-1`, `lesson-2`, `lesson-3` (completed/passed/incomplete, score, timeSpent); для первых 35 записей — полное прохождение (все уроки completed/passed); для курсов без manifest — доп. записи по `main`, `intro`.
- **Enrollment:** у 35 записей с полным прогрессом проставлен `completedAt` для отображения «Завершён» в ЛК.
- **SystemSetting:** добавлен ключ `scorm_max_size_mb` (200) в блок настроек по умолчанию.

**Файл:** prisma/seed.ts.

---

## 2026-03-17 — Аудит производительности и безопасности (план доработок)

**Задача:** реализовать план из аудита (поддержка 300+ онлайн пользователей, устранение уязвимостей).

**Фаза 1 — Безопасность:**
- **S1 Zip Slip:** в загрузке SCORM (upload/route.ts) проверка `path.resolve(fullPath).startsWith(resolvedPrefix)` перед записью каждого файла из ZIP.
- **S2 Enrollment:** в POST `/api/portal/scorm/progress` проверка `enrollment` для userId+courseId (кроме admin); при отсутствии — 403.
- **S5 Path traversal:** в рассылках (attachments) использование `path.basename(file.name)` и проверка `fullPath.startsWith(uploadsRoot)` при POST и DELETE.
- **S3 /api/chat:** обязательная сессия `getServerSession`; без входа — 401.
- **S4 Telegram webhook:** проверка заголовка `X-Telegram-Bot-Api-Secret-Token` при заданном `TELEGRAM_WEBHOOK_SECRET`.
- **S6 Cron:** при отсутствии `CRON_SECRET` возврат 503 (рассылка не выполняется).
- **S7 Media upload:** лимиты типа файла (ALLOWED_TYPES) и размера (50 МБ).
- **S8 Rate limiting:** `lib/rate-limit.ts` (in-memory); лимиты на register (3/мин), forgot-password (5/мин), contact (5/мин), chat (10/мин), payment/create (10/мин).
- **S9 XSS:** санитизация контента публикаций через `sanitize-html` (lib/sanitize.ts), использование в app/news/[id]/page.tsx.
- **S10 NEXTAUTH_SECRET:** в production при отсутствии секрета — throw в lib/auth.ts и 500 в middleware.

**Фаза 2 — Масштабируемость:**
- **P2 Индексы:** добавлены индексы в schema и миграция `20260317100000_add_perf_indexes` (VisitLog, Profile, Enrollment, Certificate, Media, Notification, Ticket, AuditLog, Lead, Order, Publication).
- **P5 Ping:** интервал 120 с (PortalUIProvider); в `recordVisitOrUpdate` один `updateMany` вместо findFirst + update.
- **P6 SCORM progress:** интервал опроса 45 с (play/page.tsx).
- **P4 claim-orders:** cookie `avaterra_claim_checked` (1 день) — вызов только при первом заходе в портал за сессию; батч: один findMany по сервисам и один по курсам вместо N findFirst.
- **P3 take-лимиты:** добавлены разумные `take` в admin payments export (10000), monitoring online (500), visits (50000), admin users (2000), courses (1000), student courses enrollments (500), allCourses (500).
- **P1 PostgreSQL:** в проде по-прежнему рекомендуется сменить provider в schema и задать DATABASE_URL (см. docs/Deploy.md).

**Фаза 3 — Производительность:**
- **P10 Шрифты:** в globals.css уже используется `display=swap` в URL Google Fonts.
- **P8 Кеш PDF:** при скачивании сертификата (admin и portal) — если есть `pdfUrl` и файл в хранилище, отдача из кеша; иначе генерация, сохранение в `uploads/certificates/{certId}.pdf`, обновление `certificate.pdfUrl`.
- **P7 Рассылки:** POST send возвращает 202 и запускает `runMailingSend` в фоне; клиент показывает тост и опрашивает список каждые 5 с в течение 1 мин.
- **Лимит SCORM:** размер архива до 200 МБ (upload/route.ts).
- **P9 Хранилище:** `lib/storage.ts` — абстракция storageWrite/storageRead/storageExists для последующей замены на S3/R2.

**Файлы:** app/api/portal/admin/courses/upload/route.ts, app/api/portal/scorm/progress/route.ts, app/api/portal/admin/mailings/[id]/attachments/route.ts, app/api/chat/route.ts, app/api/portal/telegram/webhook/route.ts, app/api/cron/mailings-send/route.ts, app/api/portal/admin/media/upload/route.ts, lib/rate-limit.ts, app/api/auth/register/route.ts, app/api/auth/forgot-password/route.ts, app/api/contact/route.ts, app/api/payment/create/route.ts, lib/sanitize.ts, app/news/[id]/page.tsx, lib/auth.ts, middleware.ts, prisma/schema.prisma, prisma/migrations/20260317100000_add_perf_indexes/migration.sql, components/portal/PortalUIProvider.tsx, lib/visits.ts, app/portal/student/courses/[courseId]/play/page.tsx, lib/claim-orders.ts, app/portal/layout.tsx, app/api/portal/admin/mailings/[id]/send/route.ts, app/portal/admin/mailings/MailingsAdminClient.tsx, lib/storage.ts, app/api/portal/admin/certificates/[certId]/download/route.ts, app/api/portal/certificates/[certId]/download/route.ts, и страницы/API с take-лимитами.

---

## 2026-03-12 — AI-помощники: тикеты, шаблоны, рассылки

**Задача:** добавить кнопки генерации/подсказок текста в тикетах поддержки, шаблонах коммуникаций и уведомлений, форме рассылок (по аудиту docs/AI-Assistants-Audit.md).

**Что сделано:**
- **Общий API генерации текста:** POST `/api/portal/admin/ai-settings/generate-text` — тело `{ instruction, context?, systemPrompt?, maxTokens? }`, ключ LlmSetting `chatbot`, ответ `{ content }`. Для черновиков в админке.
- **Тикеты:** POST `/api/portal/tickets/[id]/suggest-reply` (доступ менеджеру и админу). В форме ответа в TicketThread при `canChangeStatus || canAssign` добавлена кнопка «AI предложить ответ» — подставляет черновик в поле ответа.
- **Шаблоны коммуникаций:** в форме шаблона (TemplateForm в CommunicationsClient) — кнопка «AI сгенерировать» рядом с полем «Тема»; заполняет тему и тело по названию и каналу (парсинг ответа «Тема: … Тело: …»).
- **Шаблоны уведомлений:** в NotificationTemplateForm — кнопка «AI сгенерировать» для темы и текста по названию и типу канала.
- **Рассылки:** в форме создания/редактирования рассылки (MailingsAdminClient) — кнопка «AI предложить тему и текст» по внутреннему названию; заполняет тему письма и HTML-тело.

**Файлы:** app/api/portal/admin/ai-settings/generate-text/route.ts (новый), app/api/portal/tickets/[id]/suggest-reply/route.ts (новый), components/portal/TicketThread.tsx, app/portal/admin/communications/CommunicationsClient.tsx, app/portal/admin/notification-templates/NotificationTemplateForm.tsx, app/portal/admin/mailings/MailingsAdminClient.tsx. Исправлен variant кнопки (outline → secondary) в TicketThread и CourseCoverBlock для соответствия компоненту Button.

---

## 2026-03-12 — Сортировка по колонкам на всех таблицах админки

**Задача:** сделать сортировку по клику на заголовок колонки на всех таблицах, как на странице «Медиатека».

**Что сделано:**
- Добавлены **SortableTableHead**, состояние sortKey/sortDir, **sortTableBy** и геттеры для колонок в клиентских таблицах:
  - **Журнал уведомлений** (NotificationLogsClient): Дата, Получатель, Событие, Тема, Канал, Контент.
  - **Рассылки** (MailingsAdminClient): Название, Тема, Статус, Создана, Получателей.
  - **Публикации** (PublicationsAdminClient): Название, Тип, Дата размещения, Статус, Просмотры.
  - **Коммуникации** (CommunicationsClient): шаблоны — Название, Канал, Тема; последние отправки — Дата, Канал, Получатель, Статус.
  - **Шаблоны уведомлений** (NotificationTemplatesTableClient): Название, Тема, Канал.
  - **Шаблоны сертификатов** (CertificateTemplatesTableClient): Название, Курс, Подложка, minScore, Скачивание, Сертификатов.
  - **Наборы уведомлений** (NotificationSetsTableClient): Тип события, Название, По умолчанию.
  - **Курсы** (CoursesAdminClient): Название, Начало, Окончание, Статус, Цена, SCORM (кликабельные заголовки в нативной таблице).
  - **Мониторинг** (MonitoringClient): вкладки «Пользователи Online» и «Посещения» — сортировка по пользователю, роли, времени входа, последнему запросу, IP; по пользователю и количеству посещений.
- Таблицы **Медиатека**, **Аудит**, **Оплаты**, **CRM**, **Сертификаты** и **Пользователи** (UsersTable с TanStack Table) уже имели сортировку.

**Файлы:** app/portal/admin/notification-logs/NotificationLogsClient.tsx, app/portal/admin/mailings/MailingsAdminClient.tsx, app/portal/admin/publications/PublicationsAdminClient.tsx, app/portal/admin/communications/CommunicationsClient.tsx, app/portal/admin/notification-templates/NotificationTemplatesTableClient.tsx, app/portal/admin/certificate-templates/CertificateTemplatesTableClient.tsx, app/portal/admin/notification-sets/NotificationSetsTableClient.tsx, app/portal/admin/courses/CoursesAdminClient.tsx, app/portal/admin/monitoring/MonitoringClient.tsx, docs/Diary.md.

---

## 2026-03-12 — Обложка курса и обложка в медиатеке

**Задача:** в карточке курса (админка) — возможность прикрепить обложку; в карточке ресурса медиатеки — такая же настройка.

**Что сделано:**
- **Курс:** На странице карточки курса `/portal/admin/courses/[courseId]` (вкладка «Обзор») добавлен блок **«Обложка курса»** (компонент CourseCoverBlock): превью текущей обложки, кнопка «Загрузить файл» (JPEG, PNG, GIF, WebP до 5 МБ), поле «или URL обложки» и кнопка «Сохранить». API POST `/api/portal/admin/courses/[courseId]/cover` — приём multipart-файла, сохранение в `public/uploads/courses/`, обновление поля `Course.thumbnailUrl`.
- **Медиатека:** В модель **Media** добавлено поле **thumbnailUrl** (обложка/превью). Миграция `20260316100000_media_thumbnail_url`. В форме редактирования ресурса (EditMediaDialog) добавлено поле «Обложка (превью)» — URL изображения для карточки ресурса. Валидация и PATCH API обновлены для `thumbnailUrl`.

**Файлы:** app/api/portal/admin/courses/[courseId]/cover/route.ts (новый), app/portal/admin/courses/[courseId]/CourseCoverBlock.tsx (новый), app/portal/admin/courses/[courseId]/page.tsx, prisma/schema.prisma, prisma/migrations/20260316100000_media_thumbnail_url/migration.sql, lib/validations/media.ts, app/api/portal/admin/media/[id]/route.ts, app/portal/admin/media/MediaAdminClient.tsx, app/portal/admin/media/page.tsx, docs/Diary.md.

---

## 2026-03-12 — Исправление предупреждений ESLint (build без warnings)

**Задача:** убрать предупреждения линтера, выводимые при `npm run build`.

**Что сделано:**
- **AuditLogClient.tsx:** объект `auditSortGetters` вынесен в `useMemo` с пустым массивом зависимостей и добавлен в зависимости `useMemo` для `sorted`, чтобы удовлетворить react-hooks/exhaustive-deps.
- **SortableTableHead.tsx:** атрибут `aria-sort` перенесён с кнопки на элемент `<th>` (TableHead), так как aria-sort поддерживается ролью columnheader (у ячейки th в таблице), а не role button. Добавлен `scope="col"` для доступности.

**Файлы:** app/portal/admin/audit/AuditLogClient.tsx, components/ui/SortableTableHead.tsx, docs/Diary.md.

---

## 2026-03-12 — Метаданные для оставшихся страниц портала и плеера

**Задача:** закрыть метаданные на всех страницах портала (динамические маршруты, страницы «new», плеер).

**Что сделано:**
- **generateMetadata** добавлен на: группа `/portal/admin/groups/[id]` (имя группы); шаблон уведомления `/portal/admin/notification-templates/[id]` (имя шаблона); шаблон сертификата `/portal/admin/certificate-templates/[id]` (имя шаблона); посещения пользователя `/portal/admin/monitoring/visits/user/[userId]` (title «Посещения: {displayName/email}»).
- **Статический metadata** на страницы создания: «Новый шаблон сертификата» (`certificate-templates/new`), «Новый шаблон уведомления» (`notification-templates/new`).
- Для клиентской страницы SCORM-плеера добавлен **layout.tsx** в `app/portal/student/courses/[courseId]/play/` с `metadata: { title: 'Плеер' }`, чтобы во вкладке при воспроизведении курса отображался заголовок «Плеер».

**Файлы:** app/portal/admin/groups/[id]/page.tsx, app/portal/admin/notification-templates/[id]/page.tsx, app/portal/admin/certificate-templates/[id]/page.tsx, app/portal/admin/certificate-templates/new/page.tsx, app/portal/admin/notification-templates/new/page.tsx, app/portal/admin/monitoring/visits/user/[userId]/page.tsx, app/portal/student/courses/[courseId]/play/layout.tsx, docs/Diary.md.

---

## 2026-03-12 — Динамические метаданные (generateMetadata) для страниц с [id] / [courseId]

**Задача:** во вкладке браузера показывать осмысленный заголовок на страницах тикета, курса, пользователя, рассылки и т.д.

**Что сделано:**
- **generateMetadata** добавлен на динамические маршруты портала:
  - Менеджер: тикет `/portal/manager/tickets/[id]` — title = тема тикета (до 50 символов).
  - Студент: обращение `/portal/student/support/[id]` — title = тема тикета (с проверкой userId, без утечки чужих данных).
  - Студент: курс `/portal/student/courses/[courseId]` — title = название курса.
  - Студент: медиа `/portal/student/media/[id]` — title = название ресурса.
  - Админ: пользователь `/portal/admin/users/[id]` — title = displayName/email.
  - Админ: курс `/portal/admin/courses/[courseId]` — title = название курса.
  - Админ: прогресс участника `/portal/admin/courses/[courseId]/enrollments/[userId]` — title = «Прогресс: {курс} — {участник}».
  - Админ: набор уведомлений `/portal/admin/notification-sets/[id]` — title = имя набора.
  - Админ: рассылка `/portal/admin/mailings/[id]` — title = internalTitle рассылки.
- При отсутствии сущности возвращается нейтральный title (например «Тикет», «Обращение», «Курс»).

**Файлы:** app/portal/manager/tickets/[id]/page.tsx, app/portal/student/support/[id]/page.tsx, app/portal/student/courses/[courseId]/page.tsx, app/portal/student/media/[id]/page.tsx, app/portal/admin/users/[id]/page.tsx, app/portal/admin/courses/[courseId]/page.tsx, app/portal/admin/courses/[courseId]/enrollments/[userId]/page.tsx, app/portal/admin/notification-sets/[id]/page.tsx, app/portal/admin/mailings/[id]/page.tsx, docs/Diary.md.

---

## 2026-03-12 — Метаданные (title) для всех основных страниц портала

**Задача:** во вкладке браузера отображать осмысленные заголовки на всех ключевых страницах портала.

**Что сделано:**
- Экспорт **metadata: { title: '…' }** добавлен на страницы: студент — Мои курсы, Профиль, Поддержка, Сертификаты, Уведомления, Медиатека, Помощь; менеджер — Тикеты, Пользователи, Верификация заданий, Помощь; админ — Пользователи, Курсы, Настройки, Помощь, Оплаты, CRM, Медиатека, Сертификаты, Коммуникации, Рассылки, Аудит, Отчёты, Группы, Публикации, Мониторинг, Журнал уведомлений, Наборы уведомлений, Шаблоны уведомлений, Шаблоны сертификатов, Настройки AI. Итог: во вкладке «Название страницы | AVATERRA» (или portal_title из настроек).
- В **CHANGELOG.md** [Unreleased] добавлена сводка по портальному UX и метаданным (header, редирект по роли, переключатель ролей, иконка уведомлений, loading, title для страниц).

**Файлы:** app/portal/student/*/page.tsx, app/portal/manager/*/page.tsx, app/portal/admin/*/page.tsx (перечисленные разделы), CHANGELOG.md, docs/Diary.md.

---

## 2026-03-12 — Загрузка портала и метаданные вкладок

**Задача:** улучшить UX при переходе в портал и отображение заголовков во вкладке браузера.

**Что сделано:**
- Добавлен **app/portal/loading.tsx**: при загрузке сегмента /portal показывается индикатор «Загрузка…» (спиннер и текст на фоне portal-bg), пока не выполнится редирект по роли или не отрисуется дочерний layout.
- В **app/portal/layout.tsx** добавлен **generateMetadata()**: заголовок по умолчанию «Портал {portal_title}», шаблон «%s | {portal_title}» для дочерних страниц (portal_title из SystemSetting).
- На страницах дашбордов (student, admin, manager) экспортирован **metadata: { title: 'Дашборд' }**, чтобы во вкладке отображалось «Дашборд | AVATERRA» (или иное значение portal_title).

**Файлы:** app/portal/loading.tsx, app/portal/layout.tsx, app/portal/student/dashboard/page.tsx, app/portal/admin/dashboard/page.tsx, app/portal/manager/dashboard/page.tsx, docs/Diary.md.

---

## 2026-03-12 — Шапка портала и ссылка «уведомлений» по ролям

**Задача:** довести портальный shell до вида «header + sidebar» и сделать иконку колокольчика полезной для всех ролей.

**Что сделано:**
- В **app/portal/layout.tsx** добавлен рендер **PortalHeader**: шапка портала (логотип/название, иконка уведомлений/тикетов/журнала, аватар и дропдаун с профилем и выходом) отображается над контентом (сайдбар + main). Раньше PortalHeader был описан в документации, но не подключался в layout.
- **PortalHeader:** иконка колокольчика ведёт по ролям: студент — «Уведомления» (/portal/student/notifications), менеджер — «Тикеты» (/portal/manager/tickets), админ — «Журнал уведомлений» (/portal/admin/notification-logs). aria-label для иконки задаётся в зависимости от роли.

**Файлы:** app/portal/layout.tsx, components/portal/PortalHeader.tsx, docs/Diary.md.

---

## 2026-03-10 — Документация и UX после аудита пути

**Задача:** актуализировать справочники и улучшить переход из тикета к заказу.

**Что сделано:**
- **Support.md:** обновлён блок про оплату и поддержку: страница /success с ?order=, шаблоны писем об оплате в настройках, связь лид ↔ заказ, тикет «Нет доступа» с привязкой заказа.
- **Оплаты:** страница /portal/admin/payments принимает query `?search=…`; начальное значение поиска передаётся в PaymentsTableClient (initialSearch), таблица открывается с уже отфильтрованным заказом.
- **Тикет:** при наличии привязанного заказа (orderNumber) для роли admin номер заказа — ссылка на /portal/admin/payments?search=ORDER_NUMBER; для manager — только текст «Заказ: …» (canLinkOrderToPayments).
- **CHANGELOG.md:** в [Unreleased] добавлена сводка по доработкам аудита пользовательского пути (claim, письма, set-password, welcome, тикеты, шаблоны оплаты, онбординг, Lead↔Order, авто-тикет, ссылки).

**Файлы:** docs/Support.md, app/portal/admin/payments/page.tsx, PaymentsTableClient.tsx, components/portal/TicketThread.tsx, app/portal/manager/tickets/[id]/page.tsx, CHANGELOG.md.

---

## 2026-03-10 — Авто-тикет «Нет доступа после оплаты» (7.4)

**Задача:** при обращении в поддержку — если есть оплаченный заказ без доступа по email пользователя, привязать заказ к тикету и предложить тему «Не приходит доступ».

**Что сделано:**
- В модель **Ticket** добавлено поле **orderNumber** (String?). Миграция 20260315100000_ticket_order_number.
- В **POST /api/portal/tickets** при создании тикета: получаем email пользователя, вызываем **claimPaidOrdersForUser** (чтобы по возможности восстановить доступ), затем ищем оплаченный заказ с курсом, по которому у пользователя нет записи Enrollment. Если такой заказ найден — выставляем тикету subject «Не приходит доступ — …» (если пользователь уже написал «Не приходит доступ», не дублируем) и **orderNumber** = номер заказа.
- В письме менеджеру о новом тикете добавлена строка «Привязан заказ (нет доступа): …» при наличии orderNumber.
- В **TicketThread** (интерфейс менеджера) в шапке тикета выводится «Заказ: …» при наличии orderNumber.
- Страница менеджера тикета передаёт ticket.orderNumber в TicketThread.

**Файлы:** prisma/schema.prisma, prisma/migrations/20260315100000_ticket_order_number/migration.sql, app/api/portal/tickets/route.ts, components/portal/TicketThread.tsx, app/portal/manager/tickets/[id]/page.tsx, docs/Tasktracker.md.

---

## 2026-03-10 — Связь Lead ↔ Order (1.3)

**Задача:** при создании/оплате заказа по email, совпадающему с лидом, проставлять в Lead ссылку на заказ для аналитики.

**Что сделано:**
- В модель **Lead** добавлено поле **lastOrderNumber** (String?, опционально). Миграция 20260314100000_lead_last_order_number.
- В **webhook PayKeeper** после установки заказа в статус paid: поиск лидов с тем же email (нормализация trim+lowercase), обновление у них lastOrderNumber = orderid.
- В **CRM**: в данных лида передаётся last_order_number; в карточке лида (диалог) выводится строка «Оплаченный заказ: …» при наличии; в экспорт CSV добавлена колонка last_order_number.

**Файлы:** prisma/schema.prisma, prisma/migrations/20260314100000_lead_last_order_number/migration.sql, app/api/webhook/paykeeper/route.ts, app/portal/admin/crm/page.tsx, app/portal/admin/crm/CrmLeadsClient.tsx, docs/Tasktracker.md.

---

## 2026-03-10 — Query order на /success и шаблоны ответов (4.2, 7.3)

**Задача:** поддержка ?order= на странице успешной оплаты; шаблоны быстрых ответов в тикете для менеджера.

**Что сделано:**
- **4.2 — /success?order=ORDER_NUMBER:** страница success принимает searchParams.order; для гостя по номеру заказа загружается Order (status=paid), показывается сообщение «Заказ № … оплачен» и маскированный email (первые 2 символа + *** + @домен). Редирект после оплаты формируется с order: в app/api/payment/create/route.ts successRedirectUrl задаётся как `/success?order=${orderNumber}`.
- **7.3 — Шаблоны быстрых ответов:** в TicketThread при canChangeStatus или canAssign отображается выпадающий список «Шаблон ответа» с вариантами: «Доступ откроется в течение 24 часов», «Проверьте раздел „Мои курсы“», «Мы уточняем информацию», «Регистрация с email оплаты». Выбор подставляет текст в поле ответа (дополняя существующий).

**Файлы:** app/success/page.tsx, app/api/payment/create/route.ts, components/portal/TicketThread.tsx, docs/Tasktracker.md.

---

## 2026-03-10 — Шаблоны писем об оплате и онбординг (2.2, 6.3)

**Задача:** вынести тексты писем об оплате в настройки (User-Journey 2.2); добавить подсказку при первом визите в ЛК студента (6.3).

**Что сделано:**
- **Шаблоны писем об оплате (2.2):** в **lib/settings.ts** добавлены `getPaymentEmailTemplates()`, `renderPaymentEmailTemplate()`, кэш и ключи SystemSetting: `email_payment_course_subject`, `email_payment_course_body`, `email_payment_generic_subject`, `email_payment_generic_body`. Плейсхолдеры: `{{orderid}}`, `{{courseTitle}}`, `{{loginUrl}}`, `{{successUrl}}`, `{{portal_title}}`. Webhook PayKeeper использует шаблоны из БД; при пустых значениях — дефолтные тексты. В админке (Настройки) добавлена карточка «Шаблоны писем об оплате» с полями тема/тело для курса и для оплаты без курса. API GET/PATCH настроек расширен поддержкой этих ключей; после PATCH вызывается `clearPaymentEmailTemplatesCache()`.
- **Онбординг (6.3):** компонент **StudentOnboardingHint** на дашборде студента: при первом визите (проверка localStorage `avaterra_student_onboarding_seen`) показывается подсказка с текстом про «Мои курсы» и «Поддержка», кнопки перехода и «Понятно». После закрытия (крестик или «Понятно») флаг записывается в localStorage, подсказка больше не показывается.

**Файлы:** lib/settings.ts, app/api/webhook/paykeeper/route.ts, app/api/portal/admin/settings/route.ts, app/portal/admin/settings/SettingsForms.tsx, components/portal/StudentOnboardingHint.tsx, app/portal/student/dashboard/page.tsx, docs/Tasktracker.md.

---

## 2026-03-10 — Аудит пользовательского пути

**Задача:** провести полный аудит от консультации/покупки до авторегистрации и автоподдержки, продумать сценарии и добавить в план недостающий функционал.

**Что сделано:**
- Реализованы блок 1.2 (экран после заявки) и сброс пароля (8.1): в **Contact.tsx** при status === 'sent' показывается блок «Спасибо, заявка принята» с кнопкой «Оплатить консультацию или курс» (#pricing) и ссылкой «Отправить ещё одну заявку». Сброс пароля по email: см. ниже.
- Реализован сброс пароля по email (блок 8.1): страница **/reset-password** с формой email, **POST /api/auth/forgot-password** (поиск пользователя, создание PasswordToken, отправка письма со ссылкой на /set-password?token=…). Ответ всегда success, чтобы не раскрывать наличие email. На странице входа добавлена ссылка «Забыли пароль?». Используются те же механизм и страница установки пароля, что и при конвертации лида.
- Реализованы блоки 4.1 и 3.2 (success и привязка при входе): вынесена логика привязки заказов в **lib/claim-orders.ts** (claimPaidOrdersForUser); в **app/portal/layout.tsx** при роли student вызывается claimPaidOrdersForUser при каждом входе в портал (страховка); **страница /success** для авторизованного пользователя показывает «Ваш курс / Ваши курсы уже в разделе „Мои курсы“» и название первого курса. Register использует claimPaidOrdersForUser из lib.
- Реализованы блоки 6 и 7 (приветствие и поддержка): **welcome** — в lib/email-templates добавлен шаблон «Добро пожаловать» (eventType welcome); в POST /api/auth/register после claimPaidOrders вызывается triggerNotification('welcome'). **Тикеты:** при создании обращения (POST /api/portal/tickets) студенту отправляется письмо «Обращение в поддержку принято» (тема, номер тикета); на адрес resend_notify_email — письмо «Новое обращение в поддержку» (от кого, тема, текст, ссылка в портал менеджера). Tasktracker обновлён.
- Реализованы блок 5 (конвертация лида + установка пароля): модель **PasswordToken** (одноразовый токен, 48 ч), **lib/password-token.ts** (createPasswordToken, getUserIdByPasswordToken, consumePasswordToken), **POST /api/auth/set-password** (установка пароля по токену, удаление токена), страница **/set-password?token=…** (форма пароль/подтверждение, редирект на /login). В **POST /api/portal/admin/leads/convert** после создания пользователя: генерация токена, отправка клиенту письма «Установите пароль» со ссылкой на /set-password?token=…. Миграция 20260313100000_add_password_token.
- Реализованы задачи из плана User-Journey-Audit: **3.1** привязка оплаченных заказов при регистрации (`claimPaidOrdersForNewUser` в POST `/api/auth/register` — поиск оплаченных Order по email, создание Enrollment, triggerNotification, Order.userId); **2.1** письмо при оплате тарифа без курса (webhook PayKeeper — ветка `else` с письмом «Оплата получена, свяжемся с вами»); **1.1** письмо клиенту «Заявка принята» (POST `/api/contact` — при указании email отправка подтверждения клиенту). В Tasktracker статусы этих задач обновлены на «Завершена».
- Добавлен документ **docs/User-Journey-Audit.md**: описание текущих потоков (заявка, оплата, webhook, регистрация, конвертация лида, поддержка, уведомления), полный перечень сценариев (A–H), выявленные пробелы и **план доработок** по 8 блокам (заявка, оплата/webhook, авторегистрация и привязка заказа, страница success, конвертация лида и установка пароля, приветствие/онбординг, поддержка, сброс пароля). Критический пункт: привязка оплаченных заказов при регистрации (чтобы купленный курс появлялся в ЛК после регистрации с тем же email). В Tasktracker добавлен раздел «Аудит пользовательского пути» с задачами из плана.

---

## 2026-03-10 — Прогресс SCORM: метрики и сохранение

**Задача:** прогресс прохождения не фиксировал стандартные метрики SCORM; нужно вынести их на карточку курса и отладить передачу из пакета в БД и отображение.

**Что сделано:**
- **API progress (POST):** расширен парсинг CMI — учёт полей scorm-again `CommitObject` (completionStatus, successStatus, totalTimeSeconds, score.scaled), верхнего уровня body (lesson_status, success_status, total_time), вложенного CMI (core, completion_status, score, total_time, session_time). Статусы «passed» и «completed» считаются завершением урока; сертификат выставляется при любом из них.
- **Единая проверка завершения:** функция `isLessonCompleted(status)` в API; во всех местах (страница курса, список курсов, дашборд, плеер, админка: энроллы, отчёты, AI-assist, генерация сертификатов) подсчёт завершённых уроков учитывает оба статуса.
- **Метрики на интерфейсе:** на странице курса студента — блок «Прогресс прохождения (SCORM)» с процентом, «X из Y уроков», временем и средним баллом (%). На карточке курса в списке — опциональный балл (scorePct) и время; список курсов запрашивает _avg score по ScormProgress.
- **Плеер:** обновление прогресса сразу после успешного коммита (вызов refreshProgress из xhrResponseHandler при json.success), без ожидания следующего интервала 15 сек; интервал 15 сек сохранён как резерв.

**Файлы:** `app/api/portal/scorm/progress/route.ts`, `app/portal/student/courses/[courseId]/page.tsx`, `app/portal/student/courses/[courseId]/play/page.tsx`, `components/portal/CourseCard.tsx`, `app/portal/student/courses/page.tsx`, админские энроллы и отчёты.

---

## 2026-03-10 — Полный редизайн портала (LMS)

**Задача:** переработать весь интерфейс кабинетов студента, менеджера, администратора в стиле лучших EdTech/LMS-продуктов (Mirapolis, Evolve, TalentLMS).

**Что сделано:**
- **Дизайн-система:** новые CSS-переменные `--portal-*` в `globals.css`: тёмный сайдбар, фон `#f4f4f8`, статус-цвета, тени, радиусы. Utility-классы: `portal-card`, `portal-metric`, `status-badge`, `progress-track`, `course-launch-btn`, `skeleton`, `portal-sidebar-link`.
- **PortalSidebar** — переписан: тёмный фон `#1e1340`, золотой акцент активного пункта с левой полосой, лого-блок, collapse в одной строке с первым пунктом, адаптивный overlay.
- **PortalHeader** — новый: аватар из инициалов, колокольчик уведомлений, роль пользователя, дропдаун с профилем/настройками/выходом.
- **PortalAccountBlock** — под тёмный сайдбар (золотой аватар, кнопка logout).
- **CourseCoverPlaceholder** — SVG-обложки 5 вариантов (тема мышечного тестирования), `MediaCoverPlaceholder` по типу файла (видео/PDF/аудио/изображение).
- **CourseCard** — обложка 16:9, плавающая Play-кнопка, статус-бейдж, прогресс-бар (золото→зелёный), кнопка запуска в 1 клик.
- **Дашборд студента** — welcome-баннер (тёмный градиент + шкала заряда «батарейка»), 4 статистических плитки, сетка CourseCard, уведомления.
- **Страница «Мои курсы»** — сетка CourseCard, счётчики статусов.
- **PageHeader / Card / Breadcrumbs** — обновлены под portal-токены.
- **Дашборд админа** — акцентная плитка выручки, `portal-metric` для KPI.
- Фон всех лейаутов: `var(--portal-bg)` = `#f4f4f8`.

**Формат записи:**
- **Дата**
- **Наблюдения** — что заметили, какой контекст
- **Решения** — что решили и как
- **Проблемы** — что пошло не так, что открыто

---

## 2025-03-10 (Редактирование и удаление группы из дерева)

### Наблюдения
- В дереве групп (GroupTree) можно было только добавлять подгруппы и выбирать группу для фильтрации. Редактирование и удаление группы требовали отдельного UI или не были доступны из сайдбара.

### Решения
- **GroupTree:** добавлены опциональные коллбэки `onEditGroup(groupId)` и `onDeleteGroup(groupId)`. У каждой строки группы при наведении отображаются кнопки «Редактировать» (Pencil) и «Удалить» (Trash2); клик не меняет выбранную группу (stopPropagation).
- **Страницы Курсы, Медиатека, Пользователи:** при `onEditGroup` открывается GroupFormModal с `editId`, данные группы подставляются из API GET группы. При `onDeleteGroup` показывается ConfirmDialog с текстом про отвязку дочерних групп и снятие связей; после подтверждения — DELETE с `deleteNestedItems: false`, toast, сброс выбранной группы при необходимости. Для обновления дерева после create/edit/delete используется ключ `key=moduleType-treeVersion` у GroupTree с инкрементом `treeVersion`.
- **Документация:** в Groups-Plan.md уточнено описание GroupTree (кнопки редактирования и удаления при наведении).

### Проблемы
- Нет.

---

## 2025-03-10 (Интеграция групп в Медиатеку и Пользователи)

### Наблюдения
- Иерархические группы уже реализованы для модуля «Курсы» (сайдбар, вкладка в карточке курса). По плану Groups-Plan.md нужно было подключить те же механизмы к модулям «Медиатека» и «Пользователи».

### Решения
- **Медиатека:** API GET/POST/DELETE `/api/portal/admin/media/[id]/groups` (сегмент [id] для совместимости с существующим media/[id]). Страница медиатеки обёрнута в `MediaPageWithGroups`: слева дерево групп (moduleType=media), при выборе группы список ресурсов фильтруется. В диалоге редактирования ресурса добавлен блок «Группы ресурса» (компонент `MediaItemGroupsBlock`): список групп ресурса, добавление в группу, удаление из группы.
- **Пользователи:** API GET/POST/DELETE `/api/portal/admin/users/[id]/groups` (сегмент [id]). Страница пользователей обёрнута в `UsersPageWithGroups`: дерево групп (moduleType=user), фильтрация таблицы по выбранной группе. В карточке пользователя добавлена вкладка «Группы» (`UserGroupsBlock`): список групп с ролью (участник/модератор), добавление в группу с выбором роли, удаление из группы.
- **Маршруты:** В Next.js на одном уровне пути не допускаются разные имена динамических сегментов ([id] vs [mediaId]/[userId]). Поэтому маршруты групп для media и users размещены в папках [id] (params.id в коде используется как mediaId/userId).
- **Документация:** Обновлены docs/Groups-Plan.md (раздел «Интеграция по модулям»), docs/Support.md (описание групп и разделов Медиатека/Пользователи), в Tasktracker добавлен блок «Иерархические группы» с задачами по трём модулям — все завершены.

### Проблемы
- Нет.

---

## 2025-03-10 (Шаблоны сертификатов без отдельного модуля «Образы»)

### Наблюдения
- Модули «Образы сертификатов» и «Шаблоны сертификатов» дублировали функционал: образ — это подложка + textMapping, шаблон ссылался на образ. Пользователь попросил оставить только шаблоны без потери возможностей.

### Решения
- **Схема:** Поля `backgroundImageUrl` и `textMapping` перенесены в модель `CertificateTemplate`. Модель `CertificateImage` удалена. Миграция: добавлены колонки в `CertificateTemplate`, данные скопированы из связанных образов, затем колонка `imageId` и таблица `CertificateImage` удалены.
- **API шаблонов:** GET возвращает `backgroundImageUrl`, `textMapping`; POST и PATCH принимают JSON или multipart/form-data с полем `file` (подложка PNG/JPG/PDF). При создании/редактировании с файлом подложка сохраняется в `public/uploads/certificates/`.
- **Форма шаблона:** В форме создания/редактирования — загрузка файла подложки, текстовое поле textMapping (JSON). Для редактирования добавлена опция «Удалить подложку». Выбор «образа» из списка убран.
- **Скачивание PDF:** Маршруты скачивания (студент и админ) читают `template.backgroundImageUrl` и `template.textMapping` напрямую из шаблона.
- **Удалено:** Раздел «Образы сертиф.» из сайдбара; страницы и API `/api/portal/admin/certificate-images` и `/portal/admin/certificate-images` (список, новый, [id]); компоненты CertificateImageForm, CertificateImageDelete.
- **Документация:** Support.md, Tasktracker.md, Certificates-Plan.md обновлены под единую сущность «Шаблон» с подложкой и textMapping.

### Проблемы
- Нет.

---

## 2025-03-10 (Удаление групп публикаций)

### Наблюдения
- Функционал «Группы публикаций» (рубрики) оказался непонятным и не использовался. Пользователь попросил удалить его.

### Решения
- **Схема:** Модель `PublicationGroup` удалена; из `Publication` убраны поля `groupId` и связь `group`. Миграция: пересоздание таблицы Publication без колонки groupId, удаление таблицы PublicationGroup.
- **Удалено:** API и страницы `/api/portal/admin/publication-groups`, `/portal/admin/publication-groups`; пункт меню «Группы публикаций» в сайдбаре админки.
- **Публикации:** из формы и таблицы админки убраны выбор рубрики и колонка «Рубрика»; из публичного API и страниц `/news/[id]`, виджета «Новости и анонсы» — отображение группы. Валидация (publication.ts) — поле groupId удалено.
- **Документация:** Support.md, Tasktracker.md, CHANGELOG.md, Publications-Plan.md обновлены.

### Проблемы
- Нет.

---

## 2025-03-10 (Группы публикаций и публичная рубрика)

### Наблюдения
- В плане этап 8 (Публикации) оставалась задача «Группы публикаций (каталог/рубрики)» — низкий приоритет, опционально для MVP. Модели PublicationGroup и связь Publication.groupId уже были в схеме Prisma.

### Решения
- **API CRUD групп:** GET/POST `/api/portal/admin/publication-groups`, GET/PATCH/DELETE `[id]`. В DELETE — проверка: при наличии публикаций в группе возвращается 400.
- **Админка:** страница «Группы публикаций» (`/portal/admin/publication-groups`) — таблица (название, slug, порядок, кол-во публикаций), модалки создания/редактирования. В сайдбар добавлен пункт «Группы публикаций» (FolderTree). В форме публикации — выпадающий список «Рубрика (группа)», в таблице публикаций — колонка «Рубрика».
- **Публичная сторона:** в GET `/api/publications` и GET `/api/publications/[id]` в ответ добавлено поле `group: { id, name, slug } | null`. На странице новости `/news/[id]` и в виджете «Новости и анонсы» на главной выводится название рубрики рядом с датой (если задана).
- **Документация:** Tasktracker (задача «Группы публикаций» — Завершена), Support.md (описание раздела Публикации и групп).

### Проблемы
- Нет. Деплой на прод (этап 6) остаётся в статусе «В процессе» — требует настройки окружения и БД на стороне заказчика.

---

## 2025-03-10 (Состояние плана, health check)

### Наблюдения
- По Tasktracker.md все задачи по функционалу (этапы 3–13, PayKeeper, доп. задачи) имеют статус «Завершена». В процессе остаются: «Деплой на прод» (критический) и «Ведение Diary.md» (низкий).

### Решения
- **Health check:** добавлен GET `/api/health` — возвращает 200 и `{ ok: true }` при поднятом приложении (для мониторинга и балансировщиков, Vercel). В Deploy.md в чек-лист добавлен пункт про проверку доступности.

### Проблемы
- Нет.

---

## 2025-03-10 (Фильтр публикаций по группе, итог плана)

### Наблюдения
- Все задачи по функционалу в Tasktracker имеют статус «Завершена». Деплой на прод и ведение Diary остаются в работе.

### Решения
- **Фильтр по группе:** в GET `/api/publications` добавлены опциональные параметры `groupId` и `groupSlug` — при передаче возвращаются только публикации выбранной рубрики. Позволяет на фронте делать блоки «Новости по рубрике» или отдельные страницы по slug группы без доработки бэкенда.
- **CHANGELOG:** в [Unreleased] добавлены пункты про группы публикаций (в т.ч. фильтр), health check.

### Проблемы
- Нет.

---

## 2025-03-10 (Аудит админки: группировка и UX доступа)

### Наблюдения
- В сайдбаре админки был плоский список из 20 пунктов — трудно сканировать и находить нужное. Схожий функционал не объединён (сертификаты/образы/шаблоны, рассылки/уведомления/шаблоны и т.д.).

### Решения
- **Сайдбар:** введена поддержка секций в `PortalSidebar`: опциональный проп `sections: NavSection[]` (секция = `sectionLabel` + `items`). В админке меню разбито на блоки: «Дашборд»; «Контент и обучение» (курсы, сертификаты, образы, шаблоны сертиф., публикации, группы публикаций, медиатека); «Пользователи и продажи» (пользователи, CRM, оплаты); «Коммуникации» (рассылки, коммуникации, наборы/шаблоны/журнал уведомлений); «Аналитика и контроль» (отчётность, мониторинг, журнал аудита); «Настройки» (AI, общие). Заголовки секций отображаются мелким верхним регистром; при свёрнутом сайдбаре — только иконки без подписей секций.
- **Дашборд:** добавлен блок «Быстрый переход по разделам» (`QuickAccessSection`): пять карточек по тем же смысловым группам, каждая ведёт на главную страницу раздела и содержит 2–3 ссылки на ключевые подразделы. Улучшает обнаружение функционала и сокращает число кликов.
- **Документация:** в Support.md обновлена инструкция по добавлению пункта меню (adminSections, QuickAccessSection).

### Проблемы
- Нет.

---

## 2025-03-10 (Фильтр по рубрике в админке публикаций)

### Наблюдения
- В каталоге публикаций был только фильтр по типу (новость/объявление) и поиск по названию; фильтр по группе (рубрике) отсутствовал.

### Решения
- В **PublicationsAdminClient** добавлен выпадающий список «Все рубрики» / по группам; при выборе группы таблица показывает только публикации этой рубрики. Список групп загружается тем же API, что и для формы. В **Publications-Plan.md** этап 8 отмечен выполненным, этап 9 — частично (поиск по ключевым словам оставлен опционально).

### Проблемы
- Нет.

---

## 2025-03-10 (Модуль «Медиатека» по плану Mediateka-Plan.md)

### Наблюдения
- Реализованы этапы 6–9 плана доработок медиатеки: статистика просмотров, рейтинг, студенческая страница с карточками и плеером, полировка.

### Решения
- **Этап 6:** API GET `/api/portal/media/[id]/view` — авторизованный студент получает данные ресурса, счётчик `viewsCount` увеличивается на 1. В админке счётчик уже отображался в таблице.
- **Этап 7:** API POST `/api/portal/media/[id]/rate` — тело `{ value: 1..5 }`, обновление `ratingSum` и `ratingCount`. В админке колонка «Рейтинг» (среднее), в студенческой медиатеке — блок со звёздами и отправкой оценки.
- **Этап 8:** Студенческая страница «Медиатека» переведена на PageHeader + клиентский компонент `MediaListClient`: карточки (название, категория, тип, описание, просмотры), кнопка «Смотреть» (переход на `/portal/student/media/[id]`), кнопка «Скачать» только при `allowDownload`. Страница просмотра `/portal/student/media/[id]`: при открытии вызывается view API (инкремент просмотра), отображается плеер (изображение, видео, аудио, PDF) или ссылка «Открыть/Скачать», кнопка «Скачать» при разрешённом скачивании.
- **Этап 9:** В плане отмечены рекомендуемые категории (video, pdf, image) и стили; добавлена заметка про таймаут загрузки (maxDuration в route). Предупреждение при файле > 100 МБ оставлено как опциональное.
- **Документация:** обновлены Mediateka-Plan.md (отмечены выполненные этапы), Support.md (описание раздела Медиатека).

### Проблемы
- Нет.

---

## 2025-03-10 (Форма «Добавить пользователя» в админке)

### Наблюдения
- В плане редизайна Фаза 5 предусматривала опционально форму «Добавить пользователя» в разделе Пользователи.

### Решения
- **API:** добавлен POST `/api/portal/admin/users` (только для админа): тело запроса — email, password, displayName (опционально), role (user/manager/admin). Валидация: email обязателен, пароль не менее 6 символов, проверка на дубликат email. Создаются запись User и Profile (role, status: active).
- **UI:** компонент `AddUserDialog` (кнопка «Добавить пользователя» + модальное окно с полями Email, Пароль, Имя, Роль). Кнопка вынесена в блок actions страницы «Пользователи». После успешного создания — toast, закрытие модалки, `router.refresh()` для обновления списка.

### Проблемы
- Нет.

---

## 2025-03-10 (Фаза 6: доступность и документация)

### Наблюдения
- Завершение плана редизайна админки: Фаза 6 — полировка и доступность (aria-label, обновление Support.md).

### Решения
- **aria-label:** добавлены подписи для скринридеров у кнопок без видимого текста: оплаты (Подробнее о заказе), аудит (Подробнее о записи журнала), сертификаты (Подробнее о сертификате); в участниках курса — ссылки «Карточка участника», «Изменить результаты прохождения», кнопки «Открыть/Закрыть доступ», «Завершить участие»; в медиа — кнопки пагинации «Показать по N» с aria-pressed.
- **Support.md:** добавлен раздел «Админ-панель: разделы и типовые действия» — таблица с путями и типовыми действиями по каждому разделу (Дашборд, Пользователи, Курсы, Сертификаты, Медиатека, Оплаты, CRM, Коммуникации, Наборы уведомлений, Настройки AI, Журнал аудита, Настройки). Указано, где добавлять пункт в меню (layout.tsx, adminNav).

### Проблемы
- Нет.

---

## 2025-03-10 (Фаза 5: каталог наборов уведомлений)

### Наблюдения
- В плане редизайна Фаза 5 — опционально глобальный каталог наборов уведомлений. Карточка заказа уже реализована в модалке оплат (детали, ссылка на пользователя, Подтвердить/Отменить).

### Решения
- **Каталог наборов уведомлений:** добавлена страница `/portal/admin/notification-sets` (server component): PageHeader, Card с таблицей (№, Тип события, Название, По умолчанию, Подробнее), EmptyState при отсутствии наборов. В сайдбар админки добавлен пункт «Наборы уведомлений» (Bell). В карточке набора [id] хлебные крошки ведут на «Наборы уведомлений», кнопка «К каталогу» ведёт на список.

### Проблемы
- Нет.

---

## 2025-03-10 (Фаза 4 плана редизайна админки)

### Наблюдения
- По плану Admin-Redesign-Plan.md — Фаза 4: компонент EmptyState, замена текстов «Нет записей» в таблицах, TableSkeleton при загрузке.

### Решения
- **EmptyState:** использован существующий компонент `components/ui/EmptyState.tsx` (иконка, заголовок, описание, опционально action). Во всех таблицах и блоках пустое состояние заменено на EmptyState: UsersTable, MediaAdminClient, AuditLogClient, CertificatesAdminClient, CrmLeadsClient, CommunicationsClient (с CTA «Добавить»), PaymentsTableClient; в карточке пользователя (UserDetailTabs) — табы «Записи на курсы», «Сертификаты», «Заказы», «Тикеты»; UserRecentActions; CoursesAdminClient (пустой список курсов с CTA «Создать курс»); CourseEnrollmentsClient, CourseLearningResults, CourseNotificationsBlock. Иконки: Users, FolderOpen, Inbox, Award, Mail, CreditCard, BookOpen, ClipboardList, Bell и др.
- **TableSkeleton:** при асинхронной загрузке уже использовался в AuditLogClient, CourseEnrollmentsClient, CourseLearningResults, CourseNotificationsBlock; остальные таблицы получают данные с сервера при рендере страницы.

### Проблемы
- Нет.

---

## 2025-03-10 (Фаза 3 плана редизайна админки)

### Наблюдения
- По плану Admin-Redesign-Plan.md следующая итерация — Фаза 3: колонка № в таблицах, пагинация, поиск «Найти в списке», ConfirmDialog для опасных действий.

### Решения
- **Колонка №:** добавлена во все основные таблицы админки: UsersTable (порядковый номер по странице), MediaAdminClient, AuditLogClient, CertificatesAdminClient (отдельно от «Номер сертификата»), CrmLeadsClient, CommunicationsClient (шаблоны), PaymentsTableClient.
- **Пагинация:** в Media, Audit и Certificates реализована пагинация в формате +5/+10/+50 и «Записи X–Y из Z», «Страница N из M»; при смене фильтров в аудите страница сбрасывается.
- **Поиск «Найти в списке»:** поле поиска добавлено на страницы Медиа (по названию) и Коммуникации (по названию, каналу, теме шаблона). В аудите уже был SearchInput.
- **ConfirmDialog при конвертации лида:** в CRM перед конвертацией лида в пользователя показывается диалог с текстом «Конвертировать лида в пользователя? Будет создан аккаунт для «…» (email). Лид получит статус «Конвертирован»»; кнопки из таблицы и из карточки лида открывают один и тот же диалог.

### Проблемы
- Нет.

---

## 2025-03-10 (Фаза 2 плана редизайна админки)

### Наблюдения
- По плану Admin-Redesign-Plan.md следующая итерация — Фаза 2: компонент Card, табы на карточке пользователя, единый стиль карточек.

### Решения
- **Card:** добавлен компонент `components/portal/Card.tsx` (rounded-xl border border-border bg-white p-4, опционально title, description).
- **Карточка пользователя:** создан клиентский компонент `UserDetailTabs` с табами Профиль, Записи на курсы, Сертификаты, Заказы, Тикеты. Страница `users/[id]/page.tsx` передаёт данные в табы; секции «Последние действия», списки записей/сертификатов/заказов/тикетов оформлены через Card.
- **Dashboard:** блоки метрик переведены на использование Card; блок «Выручка (мес.)» — Card с кастомным className.
- **Аудит:** блок журнала обёрнут в Card с заголовком «Журнал записей»; у AuditLogClient убран лишний mt-6.

### Проблемы
- Нет.

---

## 2025-03-10 (аудит админки и план редизайна)

### Наблюдения
- Карточка курса (courses/[courseId]) стала эталоном: табы, таблицы с фильтрами/поиском/пагинацией, dropdown «Добавить» и «Для выбранных», ConfirmDialog, Breadcrumbs, блок действий. Остальные разделы админки (пользователи, оплаты, сертификаты, медиа, CRM, коммуникации, аудит, настройки) используют разные паттерны — нет единой шапки страницы, не везде есть «К списку», пагинация и пустые состояния различаются.

### Решения
- **docs/Admin-Redesign-Plan.md:** создан детальный план доработок. Включены: (1) аудит маршрутов и связей сущностей; (2) эталонные паттерны карточки курса; (3) таблица внедрения этих паттернов по каждому разделу (пользователи, оплаты, сертификаты, медиа, CRM, коммуникации, AI, аудит, настройки, наборы уведомлений); (4) принципы редизайна UI/UX и пользовательского пути; (5) недостающий функционал по Spec и по аудиту; (6) поэтапный план (6 фаз) с чек-листом по разделам. Рекомендуется начать с Фазы 1 (компонент PageHeader и единая навигация), затем карточки и табы, таблицы и пагинация, пустые состояния, опциональный функционал.

### Проблемы
- Нет.

---

## 2025-03-10 (авто-режим: скрипты и документация)

### Наблюдения
- Продолжение по плану в автономном режиме: удобство перед деплоем и актуальность справочников.

### Решения
- **package.json:** добавлен скрипт `predeploy` — выполняет `npm run lint && npm run build`; перед релизом можно запустить одной командой.
- **Deploy.md:** в блок «Релиз v3.0.0» вместо отдельного `npm run build` указано `npm run predeploy`.
- **README.md:** в структуре проекта уточнено, что sitemap.xml и robots.txt генерируются автоматически.
- **docs/Support.md:** добавлен подраздел «Оферта и политика конфиденциальности» — где править тексты и метаданные, откуда берётся базовый URL для sitemap/robots.

### Проблемы
- Нет.

---

## 2025-03-10 (подготовка к релизу по плану)

### Наблюдения
- По плану (Tasktracker, этап 6) следующий шаг — деплой на прод. Перед ним нужно завершить подготовку: актуальный CHANGELOG и чек-лист деплоя.

### Решения
- **CHANGELOG:** в секцию [Unreleased] добавлены пункты: оферта и политика конфиденциальности (контент), SEO (метаданные для /oferta и /privacy, sitemap.ts, robots.ts). Удалён блок «Planned» — описание актуально для предрелизного состояния.
- **Deploy.md:** в чек-лист добавлены уточнения по переменным (TELEGRAM_BOT_TOKEN, ссылка на .env.example) и пункт про автоматическую генерацию sitemap/robots. Добавлен подраздел «Проверка после деплоя» (главная, оферта, политика, вход в портал, sitemap.xml, robots.txt).
- **Tasktracker:** в этап 6 добавлена задача «Подготовка к релизу (CHANGELOG, чек-лист)» со статусом «Завершена». Задача «Деплой на прод» остаётся «В процессе» до фактического выката.

### Проблемы
- Нет.

---

## 2025-03-10 (SEO: метаданные, sitemap, robots)

### Наблюдения
- Для продакшена полезны отдельные title/description у страниц оферты и политики, а также sitemap.xml и robots.txt для поисковиков.

### Решения
- **Метаданные:** у страниц /oferta и /privacy добавлен экспорт `metadata` (title, description, openGraph, robots). В результатах поиска отображаются осмысленные заголовки и описания.
- **Sitemap:** добавлен `app/sitemap.ts` — возвращает публичные URL (главная, /oferta, /privacy, /login, /register, /reset-password). Базовый URL из NEXT_PUBLIC_URL или https://avaterra.pro. changeFrequency и priority заданы для главной и остальных.
- **Robots:** добавлен `app/robots.ts` — разрешена индексация «/», запрещены /portal/, /api/, /auth/; указана ссылка на sitemap.xml.
- В Tasktracker в этап 5 (Контент и SEO) добавлена задача «Метаданные и sitemap/robots» со статусом «Завершена».

### Проблемы
- Нет.

---

## 2025-03-10 (оферта и политика конфиденциальности)

### Наблюдения
- Страницы /oferta и /privacy содержали только текст «Раздел в разработке». Для продакшена и соответствия требованиям по персональным данным нужен полноценный контент.

### Решения
- **Оферта (app/oferta/page.tsx):** добавлены разделы: общие положения, предмет договора, порядок оказания услуг, оплата и возвраты, персональные данные, заключительные положения. Текст ориентирован на образовательные и консультационные услуги школы AVATERRA.
- **Политика конфиденциальности (app/privacy/page.tsx):** добавлены разделы: общие положения, какие данные обрабатываются, цели обработки, передача третьим лицам, хранение и защита, права пользователя, cookies и аналитика, изменения политики. Учтён 152-ФЗ и типичная практика для сайта с формами и порталом.
- В Tasktracker добавлена задача «Оферта и политика конфиденциальности — контент» со статусом «Завершена».

### Проблемы
- Нет. Юридические формулировки при необходимости можно доработать с юристом; структура готова к продакшену.

---

## 2025-03-10 (полный переход admin API на requireAdminSession)

### Наблюдения
- Оставшиеся admin-маршруты переведены на `requireAdminSession()`; в админке больше не используется ручная проверка сессии через `getServerSession` + роль.

### Решения
- Переведены на `requireAdminSession()` с подстановкой `auth.userId` в аудит и в поля вроде `sentBy`/`ownerId`: comms/send, orders/[id] (GET, PATCH), certificates/[certId]/download, media/[id] (GET, PATCH, DELETE), media/upload, enrollments (POST), enrollments/[id] (DELETE), comms/recipients, certificates/generate, orders/[id]/confirm, comms/templates (GET, POST), comms/templates/[id] (GET, PATCH, DELETE), courses/[courseId]/enrollments (GET), courses/[courseId]/enrollments/[userId] (GET), comms/sends, courses/reorder, users/[id]/reset-password.
- Все маршруты в `app/api/portal/admin/*` теперь используют единый хелпер `requireAdminSession()` из `lib/auth.ts`.

### Проблемы
- Нет.

---

## 2025-03-10 (массовый переход admin API на requireAdminSession)

### Наблюдения
- Продолжение рефакторинга: все admin-маршруты переведены на единый хелпер где это уже сделано для части; добавлена ещё одна партия маршрутов.

### Решения
- На `requireAdminSession()` переведены маршруты: `leads/[id]` (PATCH), `audit` (GET), `audit/actors` (GET), `llm-settings` (POST), `certificates` (GET), `courses` (POST), `settings/env-check` (GET), `payments/export` (GET), `courses/[courseId]` (PATCH, DELETE с подстановкой `auth.userId` в writeAuditLog), `certificates/[certId]` (GET, PATCH), `leads/convert` (POST).
- Оставшиеся admin-маршруты (orders, media, enrollments, comms, certificates/download, certificates/generate, users/reset-password, courses/reorder, courses/enrollments и др.) по-прежнему используют `getServerSession`; их можно переводить по тому же шаблону при необходимости.

### Проблемы
- Нет.

---

## 2025-03-10 (хелпер админки, тип сессии, кнопка danger)

### Наблюдения
- Продолжение по рекомендациям аудита: единый способ проверки админ-сессии и тип для user в сессии.

### Решения
- **lib/auth.ts:** экспортирован тип `SessionUser` (id, role, email, name). Функция `getUser()` переведена на использование `SessionUser`. Добавлена функция `requireAdminSession()`: возвращает `{ session, userId, role }` при успехе или `null` при отсутствии сессии/не-admin; маршрут при `null` возвращает 403.
- **Рефакторинг admin API:** маршруты `PATCH /api/portal/admin/users/[id]`, `GET/PATCH /api/portal/admin/settings`, `POST /api/portal/admin/courses/upload` переведены на `requireAdminSession()` вместо ручной проверки сессии и роли.
- **Кнопка:** в `components/ui/button.tsx` добавлен вариант `danger` (красный фон). В `ConfirmDialog` кнопка подтверждения использует `variant={variant === 'danger' ? 'danger' : 'primary'}` вместо переопределения через className.

### Проблемы
- Нет.

---

## 2025-03-10 (аудит кода и правки)

### Наблюдения
- По результатам аудита кода внесены исправления по безопасности, обработке ошибок и доступности.

### Решения
- **NEXTAUTH_SECRET:** в production fallback на `avaterra-dev-secret` отключён — используется только `process.env.NEXTAUTH_SECRET`. В development по-прежнему допускается fallback. Изменения в `lib/auth.ts` и `middleware.ts`.
- **Клиентские fetch:** перед вызовом `res.json()` добавлена проверка `res.ok` в SettingsForms, SettingsEnvIndicators, AuditLogClient, UserRecentActions; при не-2xx возвращается безопасное значение или тост об ошибке.
- **API:** загрузка SCORM (courses/upload) обёрнута в try/catch с логированием и единообразным JSON-ответом при 500. В PATCH пользователя ограничена длина `displayName` (200) и `email` (255). В PATCH лида ограничена длина `notes` (2000) и `source` (100).
- **AI-настройки:** при ошибке сохранения показывается toast; при успехе — тост «Настройки сохранены». У селекта «Пресет промпта» добавлены `id="prompt-preset"` и `htmlFor` у Label.
- **a11y:** у переключателя AI-тьютора в карточке курса добавлен `aria-label` в зависимости от состояния (включён/выключен).

### Проблемы
- Нет.

---

## 2025-03-10 (AI-тьютор по курсам)

### Наблюдения
- На странице «Настройки AI» был заглушка «Включение тьютора по курсам — в разработке». Реализована возможность включать/выключать AI-тьютора отдельно для каждого курса.

### Решения
- **Схема:** в модель Course добавлено поле `aiTutorEnabled Boolean @default(true)`; миграция `add_course_ai_tutor_enabled`.
- **API:** `GET /api/portal/scorm/course-structure` возвращает `aiTutorEnabled`. `POST /api/portal/scorm/ai-assist` при `aiTutorEnabled === false` отвечает 403 с сообщением «AI-тьютор отключён для этого курса».
- **Админка:** на странице курса (Курсы → карточка курса) добавлен блок «AI-тьютор в плеере» с переключателем (CourseAiTutorToggle); сохранение через PATCH курса, в валидации добавлено поле `aiTutorEnabled`.
- **Плеер:** на странице прохождения курса виджет чата с тьютором рендерится только если в ответе course-structure приходит `aiTutorEnabled !== false`.
- Текст на странице «Настройки AI» обновлён: указано, что включение/выключение тьютора настраивается в карточке курса.

### Проблемы
- Нет.

---

## 2025-03-10 (подтверждение смены URL, блок PayKeeper в настройках)

### Наблюдения
- В плане настроек (Plan-Settings-In-Admin.md) заложено: при смене критичных настроек — краткое предупреждение; блок «Платежи (PayKeeper)» — только справочная информация.

### Решения
- **Подтверждение при смене URL:** в форме «Общие» при нажатии «Сохранить», если изменился URL сайта, показывается ConfirmDialog: «Изменить URL сайта? Изменение URL повлияет на ссылки в письмах, уведомлениях и в чат-боте. Продолжить?». После подтверждения выполняется сохранение.
- **Блок «Платежи (PayKeeper)»:** на странице настроек добавлена карточка с пояснением, что логин, пароль и секрет задаются в .env; ссылка на docs/Deploy.md.

### Проблемы
- Нет.

---

## 2025-03-10 (использование настроек в layout, футере, портале)

### Наблюдения
- Настройки из БД (SystemSetting) уже используются в API (contact, chat, comms). Для единообразия и SEO нужно подставлять их в корневой layout и в публичные компоненты.

### Решения
- **Корневой layout:** добавлен `generateMetadata()` — асинхронно вызывает `getSystemSettings()`, подставляет `site_url` в `metadataBase` и `openGraph.url`. RootLayout сделан async, получает настройки и передаёт `contact_phone` в Footer.
- **Footer:** принимает опциональный проп `contactPhone`; при наличии отображает его в блоке контактов (иначе заглушка +7 (495) 123-45-67). Для телефона формируется ссылка `tel:` только если в нём ≥10 цифр.
- **Портал:** в layout портала запрашиваются настройки вместе с getUser(); `portal_title` передаётся в PortalUIProvider и далее в PortalHeader. В шапке портала отображается название из настроек (по умолчанию «AVATERRA»).

### Проблемы
- Нет.

---

## 2025-03-10 (настройки в админке и БД)

### Наблюдения
- Реализован перенос редактируемых настроек из конфигов в меню «Настройки» админки с хранением в БД (план docs/Plan-Settings-In-Admin.md).

### Решения
- **Модель SystemSetting:** таблица key, value, category; миграция add_system_setting. Разрешённые ключи: site_url, portal_title, resend_from, resend_notify_email, contact_phone.
- **API:** GET /api/portal/admin/settings — отдаёт настройки по категориям (general, email), с подстановкой из env при отсутствии в БД. PATCH — обновление по белому списку ключей, сброс кеша и запись в AuditLog.
- **lib/settings.ts:** getSystemSettings() читает из БД с fallback на process.env, in-memory кеш 1 мин; clearSettingsCache() вызывается после PATCH.
- **Страница настроек:** блоки «Общие» (URL сайта, название портала, контактный телефон) и «Почта» (email отправителя и получателя уведомлений) с формами и кнопкой «Сохранить».
- **Использование в коде:** contact/route.ts и comms/send используют resend_from и resend_notify_email из getSystemSettings(); chat/route.ts — site_url для ссылки на курс. sendEmail() принимает опциональный параметр from.

### Проблемы
- Нет.

---

## 2025-03-10 (подготовка к деплою)

### Наблюдения
- Продолжение разработки по плану: этап 3.0 завершён, в процессе — деплой на прод (Tasktracker).

### Решения
- **Сборка:** проверена команда `npm run build` — проходит без ошибок (Next.js 14.2.35, 64 страницы).
- **Документация деплоя:** в Deploy.md добавлен раздел «БД для продакшена (PostgreSQL)» — смена provider в schema.prisma, формат DATABASE_URL, команды `prisma migrate deploy` и `prisma generate`, ссылка на Production-Server.md.

### Проблемы
- Нет.

---

## 2025-03-09 (v3.1: переход на локальную БД)

### Наблюдения
- Запрос пользователя: переделать архитектуру на локальную БД без Supabase и Docker.

### Решения
- **Prisma + SQLite:** схема в prisma/schema.prisma, клиент lib/db.ts. Миграции, seed с тестовыми пользователями (admin@test.local, manager@test.local, student@test.local — пароль Test123!).
- **NextAuth:** Credentials provider вместо Supabase Auth. login, register, middleware RBAC.
- **Хранилище:** SCORM и медиа в public/uploads/ (локальная файловая система).
- **Удалено:** lib/supabase/, пакеты @supabase/ssr, @supabase/supabase-js, supabase; папка supabase/ (миграции, config); docs/Supabase-Setup.md, Local-NoCloud.md, LocalDB.md.
- **Документация:** Project.md, README, Support, Deploy, Tasktracker — обновлены под Prisma; docs/Local-Prisma.md — инструкция локального запуска.

### Проблемы
- Нет.

---

## 2025-03-09 (v3.0: подготовка к релизу)

### Наблюдения
- Все задачи этапа 3.0 завершены. Сборка проходит успешно. Остаётся деплой на прод и тег v3.0.0.

### Решения
- **Deploy.md:** добавлен раздел «Релиз v3.0.0» с командами для тега и push.
- **vercel.json:** заголовки безопасности (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- **Supabase-Setup:** в Redirect URLs добавлен wildcard `https://*.vercel.app/auth/callback` для Vercel.

### Проблемы
- Нет.

---

## 2025-03-09 (v3.0: финальные доработки)

### Наблюдения
- Закрыты оставшиеся задачи: qa.md (таблица текущего состояния), README (портал), оптимизация изображений (next/image для логотипа и курсов).

### Решения
- **qa.md:** добавлена таблица «Текущее состояние» — ответы на вопросы из реализованной архитектуры (каталог курсов, модель продаж, стек и т.д.).
- **README:** обновлён под v3.0 — портал, роли, ссылки на Supabase-Setup, Support.
- **Оптимизация:** next/image для Header/Footer логотипа, превью курсов; remotePatterns для Supabase Storage.

### Проблемы
- Нет.

---

## 2025-03-09 (v3.0: доработки портала)

### Наблюдения
- Реализованы дополнительные функции портала: автосертификат при 100% SCORM, интеграция чат-бота с llm_settings, webhook PayKeeper с enrollment, поддержка студента (тикеты), дашборд менеджера, экспорт CSV оплат, загрузка медиа, CRM (конвертация лидов, воронка), смена ролей пользователей, бейджи Шкалы Энергии, документация Supabase и Support.

### Решения
- **Автосертификат:** при completion_status=completed в POST /api/portal/scorm/progress создаётся запись в certificates и notification.
- **Чат-бот:** /api/chat читает system_prompt, model, temperature, max_tokens из llm_settings (key=chatbot).
- **Webhook PayKeeper:** при оплате — enrollment, notification, привязка user_id; маппинг tariff_id → course_id через services.
- **Поддержка:** /portal/student/support, POST /api/portal/tickets.
- **Admin:** экспорт CSV оплат, загрузка медиа (bucket media), смена роли/статуса пользователей (PATCH /api/portal/admin/users/[id]), график выручки (recharts).
- **CRM:** конвертация лида в пользователя (auth.admin.createUser), смена статуса, воронка (CrmFunnelChart).
- **Шкала Энергии:** бейджи по XP (Новичок, Практик, Уверенный, Мастер, Эксперт).
- **Документация:** docs/Supabase-Setup.md (миграции, buckets, первый админ), docs/Support.md (структура, частые задачи).

### Проблемы
- Нет.

---

## 2025-03-09 (портал v3.0: роли, SCORM, сертификаты)

### Наблюдения
- Реализован план перехода лендинга к полноценному порталу: три роли (user, manager, admin), личные кабинеты, SCORM-плеер, сертификаты PDF, интеграции Resend и Telegram.
- Supabase возвращает вложенные связи (courses) как массив в части запросов — типизация и разбор через Array.isArray().

### Решения
- **Версионирование:** CHANGELOG.md (Keep a Changelog + SemVer), package.json 2.0.0, git tag v2.0.0.
- **Очистка:** удалены dist/ и src/ (артефакты Vite), в .gitignore добавлены *:Zone.Identifier; палитра Tailwind и globals приведены к primary #2D1B4E, secondary #D4AF37, dark #0A0E27.
- **БД:** миграции 001 (схема портала), 002 (RLS), 003 (email в profiles); триггер создания profile при регистрации.
- **Auth:** страницы login, register, reset-password; Supabase Auth; клиент через createBrowserClient (@supabase/ssr) для cookies; middleware с createServerClient и проверкой роли из profiles.
- **Портал:** app/portal/layout.tsx (shell + PortalHeader), отдельные layout и сайдбары для student, admin, manager; страницы дашбордов, курсов, сертификатов, медиатеки, уведомлений, профиля (студент); заглушки админки и менеджера.
- **SCORM:** API GET/POST /api/portal/scorm/progress; GET /api/portal/scorm/url (signed URL из Storage); страница play с iframe; загрузка ZIP через POST /api/portal/admin/courses/upload (jszip, bucket scorm).
- **Сертификаты:** lib/certificates.tsx (@react-pdf/renderer), API GET /api/portal/certificates/[certId]/download; ссылка «Скачать PDF» в ЛК студента.
- **Admin users:** таблица (TanStack Table), фильтр по статусу active/archived; данные из profiles (service role).
- **Коммуникации:** Resend в /api/contact (уведомление о заявке); lib/email.ts, lib/telegram.ts; POST /api/portal/telegram/webhook (команды /start, /progress, /cert, /help); lib/audit.ts для журнала аудита.
- **API от имени пользователя:** lib/supabase/request.ts — createClientFromRequest(request) для проверки роли в API (admin upload).
- **PayKeeper:** замена require('crypto') на ESM import crypto в lib/paykeeper.ts.

### Проблемы
- В Supabase Storage нужно вручную создать bucket «scorm» (или через dashboard) для загрузки SCORM-пакетов.
- Полноценный RTE SCORM (scorm-again) в iframe не подключён — контент грузится по URL; сохранение CMI через отдельный API при необходимости дорабатывается на клиенте контента.

---

## 2025-02-15 (продолжение: формы, валидация, защита от спама)

### Наблюдения
- Этап 3 в Tasktracker: форма обратной связи и форма записи в статусе «В процессе»; отправка уже подключена к /api/contact, кнопки ведут на #contact. Остались валидация/защита и документирование обработки заявок.

### Решения
- **Форма обратной связи и заявки:** отмечены как завершённые в Tasktracker. Кнопка «Записаться на курс» в секции Program переведена с #pricing на #contact — все заявки идут в одну форму.
- **Валидация:** на клиенте проверка телефона (не менее 10 цифр после удаления нецифровых символов); отображение сообщений об ошибках (errorMessage). На сервере в /api/contact добавлена проверка длины телефона и отклонение при неверном формате.
- **Защита от спама:** honeypot-поле «website» (скрытое, за экраном); если оно заполнено — отправка блокируется на клиенте и на сервере. Сервер возвращает 400 при заполненном honeypot.
- **Обработка заявок:** в Tasktracker отмечено «В процессе» — данные приходят в API; при настроенном Supabase пишутся в таблицу leads. Уведомления (email/мессенджеры) — отдельная задача этапа 4.

### Проблемы
- Нет.

---

## 2025-02-15 (миграция на Next.js 14 + PayKeeper + 3D по комплексному промпту)

### Наблюдения
- Клиенту не понравился предыдущий редизайн («всё стандартно»). Пользователь привёл комплексный промпт из другой модели: Next.js 14, Tailwind, Framer Motion, Three.js (частицы в Hero), shadcn/ui, PayKeeper, Supabase, Resend, деплой на Vercel. Референс дизайна — прототип Gamma; палитра: глубокие тёмные тона, золотые/бронзовые акценты (purple #2D1B4E, gold #D4AF37, dark #0A0E27).

### Решения
- **Стек:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, React Three Fiber + drei для 3D-фона Hero (частицы), shadcn-подобные UI-компоненты (button, input, label, dialog). PayKeeper — lib/paykeeper.ts (createPayKeeperInvoice, validatePayKeeperWebhook). Supabase — опционально (createClient возвращает null при отсутствии env); таблицы orders, leads, course_access — по промпту.
- **Структура:** app/layout.tsx, app/page.tsx (лендинг), app/success, app/oferta, app/privacy; app/api/payment/create, app/api/webhook/paykeeper, app/api/contact. Компоненты: sections (Header, Footer, Hero, About, Program, Author, Testimonials, Pricing, FAQ, Contact), ui (button, input, label, dialog), 3d/ParticleBackground (динамический импорт с ssr: false), PaymentModal.
- **Контент:** Сохранён контент школы AVATERRA из Content.md (Татьяна Стрельцова, форматы и цены, отзывы, контакты). Тарифы для PayKeeper: consult 5000 ₽, course 25000 ₽, online 3500 ₽.
- **Дизайн:** Тёмный фон #0A0E27, акцент #D4AF37, типографика Literata (заголовки) + Outfit (текст). Hero — полноэкран с 3D-частицами и фото Татьяны; reveal-анимации через Framer Motion (useInView). Карточки с hover и градиентами.
- **Устойчивость:** API payment/create и contact работают без Supabase (запись в БД пропускается); payment/create без PayKeeper возвращает 500 с сообщением. Старые файлы Vite (index.html, src/, vite.config.js) удалены.

### Проблемы
- Для реальных платежей необходимо настроить .env (PayKeeper, Supabase), создать таблицы orders/leads в Supabase и указать webhook URL в личном кабинете PayKeeper.

---

## 2025-02-15 (полный редизайн: тёмная тема, bento, новая типографика)

### Наблюдения
- Запрос пользователя: не нравится текущий дизайн; использовать современные технологии дизайна; переделать сайт полностью, сделать непохожим на стандартную структуру; тексты и картинки можно перегенерировать для вовлечения ЦА; запустить в режиме отладки и проверить дизайн.

### Решения
- **Структура:** Hero — split layout (фото справа, текст слева), заголовок «Тело знает ответ» вместо только «AVATERRA» для вовлечения. Секция «Почему AVATERRA» — bento-сетка (одна большая карточка, две маленькие, одна широкая). Форматы — сетка 2 колонки с выделенной карточкой «Курс AVATERRA» на всю ширину. О мастере, отзывы, контакты — без смены логики, но с новой визуальной подачей.
- **Палитра:** Тёмная тема: фон #0f0e0c, поверхности #242220, текст #f5f0e8, акцент терракотовый #c45c3e. Отход от светлой кремово-золотой схемы для более современного и запоминающегося вида.
- **Типографика:** Literata (заголовки), Outfit (текст). Кикеры (section__kicker) над заголовками, увеличенные заголовки секций.
- **Стили:** Градиенты и размытые shapes в Hero вместо фоновой картинки; поддержка prefers-reduced-motion; :focus-visible для доступности; плейсхолдер при отсутствии фото Татьяны (onerror + .has-fallback).
- **Тексты:** Подзаголовки и лиды слегка переформулированы для более живого тона («Тело знает ответ», «20+ лет мы помогаем людям обрести баланс», «Истории тех, кто прошёл путь»).
- **Запуск:** Dev-сервер Vite на http://localhost:5173/ (команда: `npm run dev` в корне проекта, в WSL: `wsl -e bash -c "cd /home/denisok/projects/AVATERRA && npm run dev"`).

### Проблемы
- Нет. Браузерная проверка через MCP недоступна в данной среде — пользователю рекомендуется открыть http://localhost:5173/ и проверить отображение самостоятельно.

---

## 2025-02-14 (новая концепция сайта с фото основательницы)

### Наблюдения
- Пользователь предоставил два реальных фото Татьяны Стрельцовой (основательницы школы) и запросил полную переделку сайта: новая структура, цели, современные тенденции, при необходимости перегенерация текста и картинок, новая концепция. Дизайн — с учётом прошлого промта (Frontend Design Skill: уникальный интерфейс, глубина, типографика, не generic AI).

### Решения
- **Концепция:** Основательница в центре (founder-led), короткие блоки, один главный CTA «Записаться». Структура: Hero с фото Татьяны → Почему AVATERRA → Форматы работы → О мастере (второе фото + история от первого лица) → Отзывы → Записаться (форма + контакты) → Футер. Убраны отдельные блоки «История», «Партнёры», «FAQ» — партнёры и цифры встроены в «Почему» и контакты.
- **Изображения:** Реальные фото сохранены в `public/images/tatiana/tatiana-hero.png` и `tatiana-about.png`. Сгенерированы новые фоны в светлой палитре: `hero-cream.jpg`, `section-cream.jpg` — кремовые, воздушные, в тон фотографий основательницы.
- **Дизайн:** Светлая элегантная тема: фон #fffefb, #faf8f5, #f5f2ec; акцент мягкое золото #a68b5b; шрифты Cormorant Garamond (заголовки), Outfit (текст). Тени, скругления, лёгкая зернистость; анимация появления при скролле (.reveal + Intersection Observer). Hero — двухколоночный layout: фото слева, текст справа (на мобиле — колонка, фото по центру).
- **Тексты:** Переписаны под новую структуру: сжатые формулировки, один призыв к действию на блок, блок «О мастере» от первого лица. Цены и форматы сохранены; отзывы слегка сокращены для читаемости.
- **Документация:** Обновлены Project.md (структура 2.0), Content.md (новый контент), Media.md (реальные фото + новые фоны).

### Проблемы
- Нет.

---

## 2025-02-14 (трёхмерный интерфейс по скиллу «дизайн интерфейса»)

### Наблюдения
- Запрос: сайт плоский и примитивный, картинки скучные — сделать трёхмерным, используя скилл по дизайну интерфейса (уникальные интерфейсы, глубина, анимация, пространственная композиция).

### Решения
- **Глубина и тени:** введены переменные --shadow-depth (3 слоя) и --shadow-depth-hover, --shadow-dramatic для карточек, изображений и блоков; у карточек и отзывов многослойные тени и усиленный hover.
- **Перспектива и 3D:** на секции history, services, why добавлена perspective; у service-card и why-card transform-style: preserve-3d, при hover — translateZ, rotateX для объёма; у history__step — лёгкий rotateX при наведении.
- **Hero:** диагональная полоса (.hero__diagonal) с градиентом для глубины; параллакс фона при скролле в main.js (лёгкое смещение и scale hero__bg-img).
- **Анимация при скролле:** класс .reveal с начальным opacity 0 и translateY(48px) scale(0.98); при появлении в зоне видимости (Intersection Observer) добавляется .is-visible с каскадной задержкой data-delay для поэтапного появления блоков.
- **Перекрытия и асимметрия:** отзывы с разным margin-top (nth-child) для лёгкого «ступенчатого» ряда; у второй карточки услуг небольшой сдвиг по вертикали; радиальные градиенты в services и contacts для атмосферы.
- **Мастер:** псевдоэлемент-ореол вокруг фото, при hover — лёгкий scale и усиленная тень у изображения.
- **Зерно:** усилена непрозрачность body::after для более выраженной текстуры.

### Проблемы
- Нет.

---

## 2025-02-14 (полный редизайн + сгенерированные изображения)

### Наблюдения
- Запрос: использовать новые скиллы в разработке дизайна, полностью переделать сайт школы, сгенерировать красивые картинки.
- Использован скилл frontend-design: bold aesthetic direction, типографика, цвет, движение, фоны и визуальные детали.

### Решения
- **Изображения:** сгенерированы 4 изображения и скопированы в `public/images/`: hero-avaterra.jpg (hero), section-harmony.jpg (история), master-portrait.jpg (блок мастера), reviews-bg.jpg (фон отзывов). Портрет мастера — плейсхолдер; при желании заменить на фото Татьяны с прототипа.
- **Эстетика:** «редакторская роскошь + органичная гармония» — доминанта глубокий лес (#1e3329), кремовый фон, золотой акцент (#b8860b). Шрифты: Fraunces (заголовки), Outfit (текст).
- **Hero:** полноэкранный фон (hero-avaterra.jpg), тёмный градиент-оверлей, кикер + крупный заголовок AVATERRA + подзаголовок, каскадная анимация появления (fadeUp).
- **Секции:** история — декоративная полоса с section-harmony.jpg; мастер — реальное фото из проекта (master-portrait.jpg); отзывы — фоновое изображение с светлым оверлеем. Зерно поверх body, тени и hover на карточках.
- **Хедер:** фиксированный, с backdrop-filter. Контент и стили переписаны в index.html и style.css.

### Проблемы
- Нет.

---

## 2025-02-14 (редизайн по Frontend Design Skill)

### Наблюдения
- Запрос на переделку дизайна с использованием скилла по фронтенд-дизайну (SkillsMP / Anthropic): выразительный, «продакшен» интерфейс без «generic AI» эстетики.

### Решения
- **Типографика:** вместо system-ui/Roboto подключены характерные шрифты: Cormorant Garamond (заголовки), Bricolage Grotesque (основной текст) — по рекомендациям скилла избегать Inter/Roboto/Arial.
- **Цвет и тема:** цельная палитра на CSS-переменных: доминанта — глубокий шалфей (2d4a3e), фон — тёплая бумага/беж (f5f0e8, ebe4d9), острый акцент — медно-янтарный (b85c38) для кнопок и ссылок.
- **Фон и глубина:** многослойные градиенты по секциям, лёгкая SVG-текстура (noise) поверх body для объёма; тени и бордеры для карточек.
- **Анимация:** осмысленное появление Hero (заголовок → подзаголовок → кнопка) с небольшим смещением и задержкой; лёгкий hover на кнопках и карточках (translateY, тень).
- **Детали:** разный radius (4px для кнопок/инпутов, 10–16px для карточек), фокус у полей формы на accent, липкий хедер с backdrop-filter.

### Проблемы
- Нет.

---

## 2025-02-14 (продолжение — вёрстка)

### Наблюдения
- Продолжение этапа 2: выбор стека и базовая вёрстка главной страницы.
- В системе не установлен Node.js/npm — сборка и dev-сервер потребуют установки Node для команд `npm install` и `npm run dev`.

### Решения
- **Стек:** Vite + vanilla HTML/CSS/JS. В корне: index.html, package.json, vite.config.js; стили и скрипты в src/ (style.css, main.js); медиа — в public/images/ (tatiana, partners, sections).
- **Лендинг:** одностраничный, все секции по Content.md: Hero, история (4 шага), услуги и цены (4 карточки), блок Татьяны Стрельцовой (плейсхолдер под фото), партнёры, отзывы, FAQ, «Почему AVATERRA», контакты с формой, футер. Шапка с якорными ссылками и бургер-меню для мобильных.
- **Стили:** по Media.md — спокойные тона (беж, мягкий зелёный, тёплый белый), переменные в :root, адаптивная сетка (grid, clamp), семантика и доступность (aria, label).
- **Форма:** разметка готова; в main.js — заглушка отправки (TODO: Formspree или свой API).
- **Изображения:** блок Татьяны — плейсхолдер; после сохранения фото с прототипа в public/images/tatiana/ заменить на тег img.

### Проблемы
- Без Node.js нельзя запустить `npm run dev` и `npm run build`. В README добавлена инструкция: установить Node.js, затем npm install && npm run dev.

---

## 2025-02-14 (позже)

### Наблюдения
- Заказчик подтвердил: все важные моменты отражены на прототипе; тексты и картинки с Татьяной Стрельцовой брать с сайта https://avaterra--6eat7ck.gamma.site/, остальные изображения переделать в сходном стиле.
- Контент прототипа получен (структура и тексты).

### Решения
- **Контент:** создан `docs/Content.md` со всеми текстами с прототипа по секциям (Hero, история, услуги и цены, Татьяна Стрельцова, партнёры, отзывы, FAQ, преимущества, контакты, футер). Использовать при вёрстке.
- **Медиа:** создан `docs/Media.md`. Фото Татьяны Стрельцовой — только с прототипа; остальные картинки — в едином стиле (спокойные, натуральные тона, тема здоровья и гармонии). Описана рекомендуемая структура папок и чек-лист.
- **Project.md:** обновлён до версии 1.1: добавлена реальная структура блоков по прототипу, ссылки на Content.md и Media.md.
- **Tasktracker.md:** отмечены как завершённые задачи «Согласовать контент и структуру по прототипу» и «Финальные тексты и медиа»; задачи по вёрстке сведены к главной странице (все секции) и решению «одна страница vs несколько».

### Проблемы
- Контактные данные в Content.md (телефон, email, адрес, сайт) взяты с прототипа; при необходимости заказчик должен прислать актуальные.
- Изображения с прототипа нужно вручную сохранить в проект (инструкция в Media.md).

---

## 2025-02-14

### Наблюдения
- Инициирован проект сайта школы AVATERRA. Цель — информационный сайт с фокусом на продажу курсов.
- Прототип на Gamma (https://avaterra--6eat7ck.gamma.site/) принят как референс; прямой доступ к нему при создании документации был недоступен.
- В корне проекта создана папка `docs/` и базовый набор документов: Project.md, Tasktracker.md, Diary.md, qa.md. Файл правил .cursorrules вынесен в корень проекта AVATERRA.

### Решения
- **Архитектура:** описан общий поток (клиент → фронтенд → формы/API → заявки/уведомления). Варианты реализации (статический сайт, SSG+CMS, full-stack) зафиксированы в Project.md; выбор отложен до ответов на qa.md.
- **Документация:** за основу взяты этапы из Project.md; Tasktracker разбит по этапам с приоритетами (Критический/Высокий/Средний/Низкий).
- **Правила:** перед операциями обращаться к `.cursorrules` в корне проекта.

### Проблемы
- Нет доступа к содержимому прототипа по ссылке (ошибка при загрузке). Рекомендуется вручную сверить структуру и контент прототипа с разделами в Project.md и Tasktracker.md.
- Остаются открытые вопросы в qa.md — их закрытие необходимо перед фиксацией стека и детализацией задач.

---

*Добавлять новые записи сверху (новая дата — новый блок с разделами Наблюдения / Решения / Проблемы).*
