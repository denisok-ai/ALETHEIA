# План доработки по результатам тестирования

**Дата:** 15 марта 2025  
**Основа:** отчёт тестирования `docs/Testing-Report-2025-03-15.md`

---

## Приоритеты

| Уровень | Описание |
|---------|----------|
| **Критично** | Блокирует ключевой сценарий или даёт ошибки в консоли |
| **Важно** | Влияет на UX, валидацию, отображение |
| **Желательно** | Улучшения, документация, стабильность |

---

## Критичные задачи

### 1. Ошибка parallel route на странице плеера SCORM

**Проблема:** В консоли при открытии `/portal/student/courses/[courseId]/play`:
```
No default component was found for a parallel route rendered on this page. Falling back to nearest NotFound boundary
```

**Статус:** Известный false positive Next.js 14. В проекте нет parallel routes (`@folder`). Плеер работает корректно. См. [issue #75310](https://github.com/vercel/next.js/issues/75310).

---

### 2. Чат-бот: «Сервис ответов временно недоступен»

**Статус:** API при отсутствии ключа возвращает 503: «Чат временно недоступен. Настройте API-ключ в Настройки AI.» Клиент отображает это сообщение. В `.env.example` добавлен комментарий про DEEPSEEK_API_KEY.

---

## Важные задачи

### 3. Toast при ошибке PayKeeper в модалке покупки

**Статус:** PaymentModal уже обрабатывает ошибки API и показывает toast.error с сообщением от сервера («Ошибка создания платежа. Проверьте настройки PayKeeper.») или fallback.

---

### 4. Валидация форм

**Статус:** Contact — HTML5 required для Имя/Телефон, кастомная проверка телефона (≥10 цифр). Login — CredentialsSignin → «Неверный email или пароль». Тикеты — ticketCreateSchema (subject обязателен), toast при ошибке.

---

### 5. data-cursor-ref и гидратация

**Статус:** Атрибут добавляется Cursor IDE. Production-сборка проходит успешно. При необходимости — исключить атрибут из серверного рендера.

---

### 6. Унификация контактов (телефон, email)

**Статус:** Телефон — Contact и Footer получают `contactPhone` из `getSystemSettings()`, единый источник. Email в футере — info@avaterra.pro (хардкод; contact_email в настройках не реализован).

---

## Желательные задачи

### 7. Документация ID публикаций

**Статус:** В `docs/Support.md` добавлен раздел «Новости и публикации» — ID строковые (nanoid), примеры ссылок.

---

### 8. next-auth CLIENT_FETCH_ERROR

**Проблема:** Периодическая ошибка при навигации.

**Действия:**
1. Проверить `NEXTAUTH_URL` в `.env` или в Настройки → Переменные окружения (должен совпадать с фактическим URL, напр. `http://localhost:3001` при dev на порту 3001).
2. Убедиться в стабильности сессии в dev (cookie, CORS).
3. См. `.env.example` — комментарий про NEXTAUTH_URL при работе на другом порту.

---

### 9. Детальная проверка админ-настроек

**Чек-лист (ручная проверка):**
- [ ] Настройки → Общие: URL сайта, название портала, контактный телефон — сохранить, перезагрузить
- [ ] Настройки → Почта: Resend (from, notify), шаблоны — сохранить
- [ ] Настройки → Платежи: PayKeeper (сервер, логин, пароль, секрет), тестовое подключение
- [ ] Настройки → Переменные окружения: NEXTAUTH_URL, Resend API ключ, DeepSeek API ключ — сохранить в БД
- [ ] Настройки AI: ключи, модели, промпты — проверить сохранение

---

## Чек-лист перед релизом

- [ ] Чат-бот отвечает (LLM настроен, DEEPSEEK_API_KEY)
- [x] Модалка покупки показывает toast при ошибке PayKeeper
- [x] Контакты на сайте единообразны (телефон из настроек)
- [x] Валидация форм работает (заявка, логин, тикеты)
- [x] `npm run build` без критичных ошибок (при MODULE_NOT_FOUND — `rm -rf .next && npm run build`)
- [ ] Консоль браузера без ошибок (warnings — по возможности устранить)
- [x] Сквозные сценарии: E2E-тесты Playwright

---

## E2E-тесты (Playwright)

**Дата настройки:** 15 марта 2025  
**Команда:** `npm run test:e2e` (все проекты). По ролям: `npm run test:e2e:guest` | `test:e2e:student` | `test:e2e:manager` | `test:e2e:admin` | `test:e2e:cross-role`; RBAC: `npm run test:e2e:rbac`.

### Найденные при первом запуске

1. **Prisma: select + include** — в `publicationComment.findMany` для `user` использовались одновременно `select` и `include`. Исправлено в `app/api/publications/[id]/comments/route.ts`.
2. **PortalLayout: Cookies** — ошибка «Cookies can only be modified in a Server Action or Route Handler» при claim orders. **Исправлено:** логика вынесена в Route Handler `GET /api/portal/claim-orders`, клиентский компонент `ClaimOrdersTrigger` вызывает его при входе студента.
3. **Курс для SCORM** — для тестов используется `course-seed-2` (без `verificationRequiredLessonIds`), чтобы сертификат выдавался автоматически после прохождения.
4. **Build MODULE_NOT_FOUND (1682.js):** при сборке с «грязным» кэшем .next — ошибка. **Решение:** `rm -rf .next && npm run build` или `npm run build:clean`. Добавлен `export const dynamic = 'force-dynamic'` в `app/api/auth/[...nextauth]/route.ts`.

### Структура тестов

- `tests/e2e/auth.setup.ts` — логин admin, manager, student
- `tests/e2e/guest/public-pages.spec.ts` — публичные страницы, модалка (в т.ч. валидация), FAQ, форма заявки, регистрация, валидация логина, защита портала
- `tests/e2e/guest/auth-login-redirect.spec.ts` — редирект после логина по роли (admin/manager/student → дашборд)
- `tests/e2e/admin/scorm-upload.spec.ts` — загрузка SCORM Agile
- `tests/e2e/admin/all-sections.spec.ts` — разделы админки
- `tests/e2e/student/dashboard.spec.ts` — дашборд, курсы (в т.ч. клик по карточке → страница курса), плеер, сертификаты, поддержка (в т.ч. валидация темы тикета)
- `tests/e2e/manager/tickets.spec.ts` — дашборд, тикеты (Excel), пользователи, верификация (фильтры a11y, Excel), ЛК студента под менеджером
- `tests/e2e/cross-role/course-flow.spec.ts` — админ загружает SCORM → студент открывает плеер
- `tests/e2e/cross-role/scorm-seed-content.spec.ts` — плеер с контентом из seed (без загрузки ZIP)
- `tests/e2e/cross-role/ticket-flow.spec.ts` — студент создаёт тикет → менеджер отвечает
- `tests/e2e/cross-role/scorm-learning-flow.spec.ts` — полный сценарий: загрузка → прохождение → сертификат → результаты в админке

---

## Связанные документы

- `docs/Testing-Report-2025-03-15.md` — полный отчёт тестирования
- `docs/Support.md` — структура проекта, частые задачи
- `docs/User-Journey-Roles-Audit.md` — пользовательские пути по ролям
