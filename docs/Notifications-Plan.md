# План разработки модуля «Уведомления»

Документ составлен на основе мини-ТЗ (инструкция Mirapolis [1–197]) и специфики мини-LMS. В проекте уже есть базовые сущности: лента уведомлений пользователя, наборы уведомлений по событиям, привязка к курсам. План дополняет их до полноценного модуля с шаблонами, плейсхолдерами и журналом для админки.

---

## 1. Назначение модуля

**Автоматическое информирование пользователей о системных событиях** по двум каналам:

- **Внутренняя система** — экран «Мои уведомления» (лента в личном кабинете).
- **Электронная почта** — отправка письма по шаблону.

---

## 2. Ключевые понятия (MVP)

| Понятие | Описание |
|---------|----------|
| **Событие** | Триггер в системе (например: «Регистрация пользователя», «Запись на курс», «Получение сертификата», «Отчисление с курса», «Открытие/закрытие доступа»). |
| **Шаблон уведомления** | Текстовая заготовка (тема + тело) с плейсхолдерами (`%recfirstname%`, `%date%` и т.д.) для подстановки данных. |
| **Правило (набор уведомлений)** | Связка «Событие + Шаблон + канал (внутренний / email / оба)»; при наступлении события система создаёт уведомление и/или отправляет письмо. |

---

## 3. Текущее состояние и целевое

| Компонент | Сейчас | Целевое |
|-----------|--------|---------|
| **Лента пользователя** | Модель `Notification` (userId, type, content JSON, isRead). Страница «Уведомления», отметка «прочитано». | Сохранить; при открытии элемента — визуально «открытый конверт» (иконка меняется после клика). Добавить удаление. |
| **Наборы по событиям** | `NotificationSet` (eventType, name, templateId?), привязка к курсу через `CourseNotificationSet`. Каталог в админке. | Правило = событие + шаблон; шаблон с темой и телом и плейсхолдерами. Связь «набор — шаблон» уже есть (templateId). |
| **Шаблоны** | `CommsTemplate` (email/telegram, subject, htmlBody, variables). | Для уведомлений: шаблоны с явным списком плейсхолдеров (%recfirstname%, %reclastname%, %date%, %systemtitle%) и типом доставки (internal/email/both). Либо расширить CommsTemplate, либо ввести `NotificationTemplate`. |
| **Инициация** | При событиях (enrollment, certificate, paykeeper и т.д.) создаётся запись в `Notification` с type и content. | Единая функция `triggerNotification(eventType, userId, metadata)`: поиск активного правила, подстановка в шаблон, запись в Notification (внутренний канал), отправка email (если канал email), запись в журнал для админки. |
| **Журнал для админки** | Нет единого журнала «кто что получил». | Таблица «Журнал уведомлений»: дата, получатель, тип события, тема, контент (срез), канал; с возможностью очистки старых записей (например, хранить последние 1000). |

---

## 4. Поддерживаемые ключевые слова (MVP)

| Плейсхолдер | Подстановка |
|-------------|-------------|
| `%recfirstname%` | Имя получателя (displayName до первого пробела или из профиля). |
| `%reclastname%` | Фамилия получателя (вторая часть displayName или пусто). |
| `%date%` | Дата события (текущая дата в момент срабатывания). |
| `%systemtitle%` | Название LMS (из настроек, например «AVATERRA»). |

При необходимости добавить: `%objectname%` (название курса/мероприятия), `%coursename%` и т.д. из `metadata`.

**Шаблоны в стиле сайта:** в `lib/email-templates.ts` заданы константы `DEFAULT_NOTIFICATION_TEMPLATES` (тема + тело для событий: запись на курс, сертификат выдан, отчисление, доступ открыт/закрыт) и функция `renderNotificationTemplate`. Письма по этим шаблонам рекомендуется оборачивать через `wrapEmailHtml()` для единого оформления AVATERRA.

---

## 5. Модель данных (расширение / новые сущности)

### 5.1. Текущие модели (оставить)

- **Notification** — лента пользователя: id, userId, type, content (JSON), isRead, createdAt.
- **NotificationSet** — набор: eventType, name, templateId (ссылка на шаблон), isDefault; привязка к курсам через CourseNotificationSet.

### 5.2. Шаблон уведомлений (новая или расширение)

**Вариант A — отдельная модель NotificationTemplate:**

```prisma
model NotificationTemplate {
  id        String   @id @default(cuid())
  name      String
  subject   String?  // тема (для email и отображения в ленте)
  body      String   // тело с плейсхолдерами (HTML или plain)
  type      String   // "internal" | "email" | "both"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  notificationSets NotificationSet[]
}
```

- В **NotificationSet** поле `templateId` ссылается на **NotificationTemplate** (или на CommsTemplate — по решению).

**Вариант B** — использовать только CommsTemplate, добавить поле `type` (internal/email/both) и документировать плейсхолдеры в интерфейсе.

### 5.3. Журнал уведомлений для админки (новая модель)

```prisma
model NotificationLog {
  id         String   @id @default(cuid())
  userId     String
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  eventType  String
  subject    String?
  content    String   // итоговый текст после подстановки (или срез)
  channel    String   // "internal" | "email"
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([userId])
}
```

- Назначение: единая таблица «что и кому было отправлено» для экрана «Журнал уведомлений» в админке; при срабатывании `triggerNotification` добавлять запись в NotificationLog при записи в Notification и при отправке email.
- **Очистка:** периодически или по кнопке удалять старые записи (например, оставлять последние 1000 или записи за последние N дней).

---

## 6. Логика (event-driven)

### 6.1. Функция triggerNotification

Сигнатура (пример):

```ts
triggerNotification(params: {
  eventType: string;
  userId: string;
  metadata?: Record<string, string | number | boolean>;
  templateOverrides?: { subject?: string; body?: string };
}): Promise<void>
```

Логика:

1. Найти активное **правило** (NotificationSet) по `eventType` (и при необходимости по контексту, например courseId). Если правил несколько — взять первое или по приоритету.
2. Загрузить **шаблон** по `templateId` правила (NotificationTemplate или CommsTemplate).
3. Загрузить данные **получателя** (User, Profile) для подстановки %recfirstname%, %reclastname%.
4. Собрать **metadata**: date, systemtitle, objectname и т.д.
5. Подставить плейсхолдеры в subject и body.
6. **Внутренний канал:** создать запись в **Notification** (userId, type=eventType, content=итоговый текст или JSON с subject/body, isRead=false).
7. **Email-канал:** если шаблон предполагает email — отправить письмо (существующий sendEmail / Resend), тема и тело — после подстановки.
8. **Журнал:** добавить запись в **NotificationLog** (userId, eventType, subject, content, channel: internal/email).

Существующие места, где создаётся Notification (enrollment, certificate, paykeeper, access opened/closed и т.д.), постепенно перевести на вызов `triggerNotification` с нужным eventType и metadata.

### 6.2. Автоматическая инициация

- События, которые уже есть в коде: запись на курс, выдача сертификата, оплата (webhook), отчисление, открытие/закрытие доступа. Для каждого при срабатывании вызывать `triggerNotification` вместо или поверх текущего создания Notification.
- Новые события (например, «Регистрация пользователя») — вызов `triggerNotification` при регистрации.

---

## 7. Пользовательский интерфейс (публичная сторона)

### 7.1. Центр уведомлений («Мои уведомления»)

- **Экран:** список полученных уведомлений (уже есть страница «Уведомления» и NotificationsList).
- **Статус:** визуальное различие прочитанных и непрочитанных (например, иконка «закрытый конверт» / «открытый конверт»). При клике по элементу — вызов API «отметить прочитанным» и смена иконки.
- **Действия:** «Отметить прочитанным» (есть), «Удалить» (добавить: удаление записи из Notification для текущего пользователя).
- **Бейдж в шапке:** иконка «колокольчик» с счётчиком непрочитанных (уже может быть в layout; при отсутствии — добавить).

---

## 8. Админ-интерфейс

### 8.1. Управление шаблонами уведомлений

- **Список шаблонов:** таблица (Название, Тип доставки, События (наборы), Действия).
- **Создание/редактирование:** поля «Название», «Тема», «Тело» (редактор с подсказкой про HTML), тип доставки (внутренний / email / оба). Блок «Доступные плейсхолдеры»: %recfirstname%, %reclastname%, %date%, %systemtitle% (и при необходимости %objectname%, %coursename%).
- Шаблоны привязываются к правилам (наборам) через существующий механизм NotificationSet.templateId.

### 8.2. Правила (наборы уведомлений)

- Уже есть: каталог наборов, привязка к курсам, выбор по eventType. Доработать: при создании/редактировании набора — выбор **шаблона уведомления** (NotificationTemplate или CommsTemplate), флаг «активно» (isActive) для включения/выключения правила без удаления.

### 8.3. Журнал уведомлений (админ)

- **Страница «Журнал уведомлений»:** только для чтения, таблица: Дата, Получатель (имя/email), Тип события, Тема, Контент (срез или превью), Канал (внутренний/email).
- Фильтры: по дате, по типу события, по получателю.
- **Очистка:** кнопка «Удалить записи старше N дней» или «Оставить последние 1000 записей» — во избежание переполнения БД (рекомендация из ТЗ).

---

## 9. API

| Метод | Маршрут | Назначение |
|-------|---------|------------|
| GET | `/api/portal/notifications` | Список уведомлений текущего пользователя (уже может быть через страницу с server fetch). |
| PATCH | `/api/portal/notifications/[id]/read` | Отметить прочитанным (есть). |
| DELETE | `/api/portal/notifications/[id]` | Удалить уведомление для текущего пользователя. |
| GET | `/api/portal/admin/notification-templates` | Список шаблонов уведомлений. |
| POST | `/api/portal/admin/notification-templates` | Создание шаблона. |
| GET | `/api/portal/admin/notification-templates/[id]` | Один шаблон. |
| PATCH | `/api/portal/admin/notification-templates/[id]` | Обновление шаблона. |
| DELETE | `/api/portal/admin/notification-templates/[id]` | Удаление (с проверкой на использование в наборах). |
| GET | `/api/portal/admin/notification-log` | Журнал уведомлений (список с фильтрами, пагинация). |
| POST | `/api/portal/admin/notification-log/cleanup` | Очистка старых записей (оставить последние N или удалить старше N дней). |

Функция `triggerNotification` вызывается из кода при наступлении событий (не обязательно как отдельный HTTP-эндпоинт).

---

## 10. Этапы реализации

### Этап 1. Шаблоны и плейсхолдеры

- [ ] Ввести модель **NotificationTemplate** (name, subject, body, type: internal/email/both) или зафиксировать использование CommsTemplate с документированными плейсхолдерами.
- [ ] Реализовать подстановку в теме и теле: %recfirstname%, %reclastname%, %date%, %systemtitle% (и при необходимости %objectname% из metadata).
- [ ] В NotificationSet: связь с шаблоном (templateId → NotificationTemplate), при необходимости поле isActive.

### Этап 2. Функция triggerNotification

- [ ] Реализовать `triggerNotification(eventType, userId, metadata)` в lib (например, `lib/notifications/trigger.ts`).
- [ ] Внутри: поиск правила по eventType, загрузка шаблона и данных пользователя, подстановка плейсхолдеров, создание Notification (внутренний канал), отправка email (если тип шаблона email/both), запись в NotificationLog (см. этап 3).
- [ ] Постепенно перевести существующие места создания Notification на вызов triggerNotification (enrollment, certificate, paykeeper, access opened/closed и т.д.).

### Этап 3. Журнал для админки

- [ ] Добавить модель **NotificationLog** (userId, eventType, subject, content, channel, createdAt).
- [ ] При срабатывании triggerNotification — писать в NotificationLog для канала internal и для email.
- [ ] API GET журнала с фильтрами и пагинацией; опционально API очистки (оставить последние 1000 или удалить старше N дней).

### Этап 4. Центр уведомлений (пользователь)

- [ ] Визуальное различие прочитанных/непрочитанных (иконка конверта: закрытый → открытый после клика).
- [ ] При клике по уведомлению — вызов PATCH read и смена иконки.
- [ ] Действие «Удалить» (DELETE для своего уведомления).
- [ ] Бейдж с количеством непрочитанных в шапке/сайдбаре (если ещё нет).

### Этап 5. Админка: шаблоны и журнал

- [ ] CRUD шаблонов уведомлений (список, форма с темой, телом, типом доставки, блок «Доступные плейсхолдеры»).
- [ ] Страница «Журнал уведомлений»: таблица (Дата, Получатель, Тип события, Тема, Контент, Канал), фильтры, очистка старых записей.
- [ ] В наборах уведомлений (NotificationSet): выбор шаблона из списка NotificationTemplate, флаг isActive.

### Этап 6. Очистка и полировка

- [ ] Автоматическая или ручная очистка NotificationLog (хранить только последние 1000 записей или по политике).
- [ ] Стили: светлый фон, белые карточки, акцентные кнопки. Документация (Support.md, Tasktracker).

---

## 11. Файлы для создания/изменения

| Файл | Действия |
|------|----------|
| `prisma/schema.prisma` | Модели NotificationTemplate, NotificationLog; при необходимости связь NotificationSet.templateId → NotificationTemplate. |
| `lib/notifications/trigger.ts` или `lib/notifications.ts` | Функция triggerNotification, подстановка плейсхолдеров, создание Notification, отправка email, запись в NotificationLog. |
| `lib/notifications/placeholders.ts` | Константы плейсхолдеров и функция замены в строке (subject/body). |
| `app/api/portal/admin/notification-templates/route.ts` | GET list, POST create. |
| `app/api/portal/admin/notification-templates/[id]/route.ts` | GET one, PATCH, DELETE. |
| `app/api/portal/admin/notification-log/route.ts` | GET список с фильтрами; POST cleanup (опционально). |
| `app/api/portal/notifications/[id]/route.ts` | DELETE удаление уведомления (только своё). |
| `app/portal/admin/notification-templates/page.tsx` | Каталог шаблонов уведомлений. |
| `app/portal/admin/notification-log/page.tsx` | Страница «Журнал уведомлений». |
| `app/portal/student/notifications/NotificationsList.tsx` | Иконка конверта (read/unread), удаление. |
| Компонент шапки/сайдбара | Бейдж «колокольчик» с счётчиком непрочитанных. |
| Места вызова (enrollment, certificate, webhook, access…) | Заменить создание Notification на triggerNotification(eventType, userId, metadata). |
| `docs/Support.md` | Раздел «Уведомления» (центр, шаблоны, журнал). |
| `docs/Tasktracker.md` | Задачи этапа «Уведомления». |

---

## 12. Критерии приёмки (MVP)

- Пользователь видит «Мои уведомления» со статусом прочитано/не прочитано; при клике — отметка прочитанным и смена иконки (закрытый → открытый конверт); можно удалить уведомление.
- В шапке/сайдбаре отображается иконка уведомлений с бейджем непрочитанных.
- В админке есть управление шаблонами уведомлений (тема, тело, плейсхолдеры %recfirstname%, %reclastname%, %date%, %systemtitle%, тип доставки internal/email/both).
- Правила (наборы) связывают событие с шаблоном; при наступлении события вызывается triggerNotification: создаётся запись в ленте пользователя и/или отправляется email, запись попадает в журнал.
- В админке есть журнал уведомлений (кто, когда, тип события, тема, канал) с возможностью очистки старых записей (например, последние 1000).
- Два канала реализованы: доставка в «колокольчик» (Notification) и запись в лог (NotificationLog); при типе шаблона email/both — реальная отправка письма.

---

## 13. Связь с существующим кодом

- **Notification, NotificationSet, CourseNotificationSet** — сохраняются; расширяются связью с шаблонами и единой функцией срабатывания.
- **CommsTemplate, CommsSend** — используются для рассылок и, при необходимости, для части email-уведомлений; шаблоны уведомлений могут быть отдельной сущностью (NotificationTemplate) для явной поддержки плейсхолдеров и каналов internal/email/both.
- **События** в `lib/notification-set-events.ts` — перечень eventType; при добавлении новых событий добавлять вызов triggerNotification в соответствующие места кода.
