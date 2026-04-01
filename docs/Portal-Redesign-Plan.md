# План доработки портала по эталону «Мои курсы»

Эталон дизайна: **http://localhost:3000/portal/student/courses**

Использовать во всех ролях: единые карточки (portal-card), кнопки (Button primary/secondary/ghost), статус-бейджи (status-badge), прогресс-бары (progress-track/fill), PageHeader, отступы и типографика.

---

## Эталонные элементы

| Элемент | Описание |
|--------|----------|
| **Фон страницы** | `var(--portal-bg)` (#F8FAFC) |
| **Карточка** | `.portal-card` — белый фон, border #E2E8F0, скругление var(--portal-radius) |
| **Заголовок страницы** | PageHeader: breadcrumbs + title (text-2xl font-bold) + description (text-sm text-muted) |
| **Кнопка основная** | Button variant="primary" — Indigo #6366F1 |
| **Кнопка вторичная** | Button variant="secondary" — outline Indigo |
| **Статус-бейдж** | .status-badge + .badge-active / .badge-info / .badge-neutral / .badge-warn |
| **Прогресс** | .progress-track + .progress-fill, подпись «X из Y», процент |
| **Сетка карточек** | grid gap-5 sm:grid-cols-2 lg:grid-cols-3 |
| **Пустое состояние** | portal-card p-10 text-center, иконка + заголовок + описание + одна кнопка |

---

## Студент (Student)

| Страница | Путь | Статус | Действия |
|----------|------|--------|----------|
| Дашборд | /portal/student/dashboard | ✅ Сделано | — |
| Мои курсы | /portal/student/courses | ✅ Эталон | — |
| Сертификаты | /portal/student/certificates | ✅ Сделано | — |
| Медиатека | /portal/student/media | ✅ Сделано | — |
| Уведомления | /portal/student/notifications | ✅ Сделано | PageHeader, portal-card в списке |
| Поддержка | /portal/student/support | ✅ Сделано | — |
| Профиль | /portal/student/profile | ✅ Сделано | PageHeader, portal-card форма, Button primary |
| Помощь | /portal/student/help | ✅ Сделано | PageHeader, HelpContent в portal-card |
| Деталь курса | /portal/student/courses/[courseId] | ✅ Сделано | Обложка, прогресс, Продолжить/Начать/Завершён |
| Просмотр медиа | /portal/student/media/[id] | ✅ Сделано | PageHeader, portal-card, кнопки Скачать/Назад |

---

## Менеджер (Manager)

| Страница | Путь | Статус | Действия |
|----------|------|--------|----------|
| Дашборд | /portal/manager/dashboard | ✅ Сделано | PageHeader, карточки метрик, последние тикеты в portal-card |
| Тикеты | /portal/manager/tickets | ✅ Сделано | PageHeader, таблица в portal-card, status-badge |
| Тикет | /portal/manager/tickets/[id] | ✅ Сделано | TicketThread: portal-card, status-badge, Button primary |
| Пользователи | /portal/manager/users | ✅ Сделано | PageHeader, поиск и таблица в portal-card |
| Верификация | /portal/manager/verifications | ✅ Сделано | PageHeader, карточки заданий, Button primary/danger |
| Помощь | /portal/manager/help | ✅ Сделано | PageHeader, HelpContent |

---

## Администратор (Admin)

| Страница | Путь | Статус | Действия |
|----------|------|--------|----------|
| Дашборд | /portal/admin/dashboard | ✅ Сделано | — |
| Курсы | /portal/admin/courses | ✅ Сделано | PageHeader, max-w-6xl |
| Курс | /portal/admin/courses/[courseId] | ✅ Сделано | portal-card блоки, вкладки и ScormManifestViewer |
| Пользователи | /portal/admin/users | ✅ Сделано | PageHeader, max-w-6xl |
| Пользователь | /portal/admin/users/[id] | ✅ Сделано | PageHeader, кнопка «Назад» в стиле портала |
| Товары (главная) | /portal/admin/shop | ✅ Сделано | ServicesAdminBlock |
| Платежи | /portal/admin/payments | ✅ Сделано | portal-card метрики, симуляция, таблица заказов, фильтры |
| CRM / Лиды | /portal/admin/crm | ✅ Сделано | portal-card метрики, воронка, таблица лидов в portal-card |
| Сертификаты | /portal/admin/certificates | ✅ Сделано | Список в portal-card, селекты и ячейки — portal стиль |
| Шаблоны сертификатов | /portal/admin/certificate-templates | ✅ Сделано | Card, таблица, кнопки и ссылки Indigo |
| Рассылки | /portal/admin/mailings | ✅ Сделано | PageHeader, max-w-6xl |
| Коммуникации | /portal/admin/communications | ✅ Сделано | PageHeader, max-w-6xl |
| Шаблоны уведомлений | /portal/admin/notification-templates | ✅ Сделано | Card, таблица, кнопки и ссылки Indigo |
| Настройки | /portal/admin/settings | ✅ Сделано | Секции в portal-card, ссылки Indigo |
| AI-настройки | /portal/admin/ai-settings | ✅ Сделано | Card (portal-card), текст portal |
| Аудит | /portal/admin/audit | ✅ Сделано | Card (portal-card), max-w-6xl |
| Отчёты | /portal/admin/reports | ✅ Сделано | PageHeader, max-w-6xl |
| Мониторинг | /portal/admin/monitoring | ✅ Сделано | PageHeader, max-w-6xl |
| Группы | /portal/admin/groups | ✅ Сделано | Card с portal-цветами, иконки Indigo |
| Медиа | /portal/admin/media | ✅ Сделано | PageHeader, max-w-6xl |
| Помощь | /portal/admin/help | ✅ Сделано | PageHeader, HelpContent, max-w-4xl |

---

## Порядок внедрения

1. **Фаза 1** — Студент: профиль, помощь, деталь курса, медиа [id].
2. **Фаза 2** — Менеджер: все страницы (дашборд, тикеты, пользователи, верификация, помощь).
3. **Фаза 3** — Админ: курсы, пользователи, платежи, CRM, сертификаты, рассылки, настройки.
4. **Фаза 4** — Админ: остальные (шаблоны, AI, аудит, отчёты, мониторинг, группы, медиа, помощь).

---

## Чек-лист для каждой страницы

- [ ] PageHeader с breadcrumbs и описанием
- [ ] Контент в .portal-card или .portal-metric где уместно
- [ ] Кнопки: Button variant="primary" | "secondary" | "ghost"
- [ ] Статусы: .status-badge + .badge-*
- [ ] Прогресс: .progress-track / .progress-fill при наличии
- [ ] Пустое состояние: иконка + текст + одна кнопка в portal-card
- [ ] Цвета текста: var(--portal-text), var(--portal-text-muted), var(--portal-text-soft)
- [ ] Отступы: space-y-6 для секций, p-5/p-6 в карточках
