# План доработки модуля «Сертификаты»

Документ составлен на основе мини-ТЗ (инструкция Mirapolis [1–144]) и текущей реализации в проекте. Модуль уже есть: выдача, реестр, скачивание PDF. План доводит его до профессиональной схемы с шаблонами (подложка + textMapping) и условиями выдачи.

**Текущая реализация:** образы объединены с шаблонами — у каждого шаблона свои поля подложки (backgroundImageUrl) и координат текста (textMapping). Отдельной сущности «Образ сертификата» нет.

---

## 1. Назначение модуля

**Учёт, генерация и выдача электронных сертификатов (PDF)**, подтверждающих успешное прохождение учебных мероприятий: настройка условий выдачи, автоматическая и ручная выдача, просмотр и скачивание с учётом прав доступа.

---

## 2. Базовые сущности

| Сущность | Описание |
|----------|----------|
| **Шаблон сертификата (CertificateTemplate)** | Название, подложка (backgroundImageUrl — PNG/JPG/PDF), textMapping (JSON координат полей), привязка к курсу, minScore, requiredStatus, validityDays, numberingFormat, allowUserDownload. |
| **Сертификат (Certificate / IssuedCertificate)** | Выданный документ: пользователь, курс, шаблон, номер, дата выдачи, дата окончания срока действия; ссылка на сгенерированный PDF (опционально, т.к. PDF можно генерировать «на лету»). |

---

## 3. Текущее состояние и целевое

| Компонент | Сейчас | Целевое |
|-----------|--------|---------|
| **Модель** | Certificate: userId, courseId, certNumber, pdfUrl?, issuedAt, revokedAt. Уникальность (userId, courseId). | Добавить templateId, expiryDate. CertificateTemplate с полями backgroundImageUrl, textMapping (подложка и координаты в самом шаблоне). |
| **PDF** | Фиксированный макет в lib/certificates.tsx (@react-pdf/renderer), без фонового изображения. | Генерация по шаблону: подложка (образ) + наложение текста по textMapping; при отсутствии образа — текущий макет по умолчанию. |
| **Выдача** | Массовая выдача по курсу (кто завершил все уроки — тому создаётся запись). Нумерация: ALT-{nanoid}. | Условия из шаблона: minScore (%), requiredStatus (например «Пройден»/completed). Автоматическая проверка checkCertificateEligibility; ручная выдача админом (модалка: пользователь + курс). Нумерация: счётчик +1 или формат CERT-%ID%. |
| **Срок действия** | Нет. | В шаблоне validityDays; при выдаче expiryDate = issuedAt + validityDays. |
| **Скачивание** | Кнопка «Скачать PDF» всегда видна пользователю; PDF генерируется при запросе (на лету). | Кнопка «Скачать» показывается только если в шаблоне включён флаг «Электронная версия доступна пользователям» (allowUserDownload). |
| **Админка** | Реестр (таблица), фильтры, массовая выдача по курсу, скачивание. | + Настройка шаблонов (образ, minScore, requiredStatus, validityDays, нумерация, allowUserDownload). + Ручная выдача (модалка: выбор пользователя и курса). |

---

## 4. Разделение процессов

- **Выдача (issue):** создание записи Certificate в БД (при выполнении условий или ручной выдаче). Не создаёт файл PDF.
- **Генерация (generate):** создание PDF-файла. В мини-LMS целесообразно выполнять **на лету** при нажатии «Скачать» (экономия места). Опционально: кэширование по pdfUrl после первой генерации.

---

## 5. Модель данных (расширение Prisma)

### 5.1. Шаблон сертификата (CertificateTemplate)

Подложка и textMapping хранятся в самом шаблоне (без отдельной сущности «Образ»).

```prisma
model CertificateTemplate {
  id                  String   @id @default(cuid())
  name                String
  backgroundImageUrl  String?  // путь к PNG/JPG/PDF подложке; загрузка в форме шаблона
  textMapping         String?  // JSON: координаты для name, date, courseTitle, certNumber
  courseId            String?  // привязка к курсу; null = общий шаблон
  course              Course?  @relation(fields: [courseId], references: [id], onDelete: Cascade)
  minScore            Int?     // минимальный % для выдачи (0–100)
  requiredStatus      String?  // например "completed"
  validityDays        Int?     // срок действия в днях; null = без срока
  numberingFormat     String?  // "CERT-%ID%" или счётчик
  allowUserDownload   Boolean  @default(true) // электронная версия доступна пользователям
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  certificates Certificate[]
}
```

### 5.3. Сертификат (расширение текущей модели Certificate)

Добавить поля:

- `templateId` (String?, связь с CertificateTemplate) — по какому шаблону выдан.
- `expiryDate` (DateTime?) — дата окончания срока действия (issuedAt + template.validityDays).

Сохранить: id, userId, courseId, certNumber, pdfUrl?, issuedAt, revokedAt. Уникальность (userId, courseId) сохраняется.

---

## 6. Логика выдачи

### 6.1. Условия выдачи (из шаблона)

- **minScore:** минимальный процент (например, от прогресса SCORM или итоговой оценки). Если в системе нет процента — считать по факту «все уроки completed».
- **requiredStatus:** статус прохождения (например, «Пройден» / completed). При совпадении с фактическим статусом пользователя по курсу — разрешать выдачу.
- Для автоматической выдачи вызывать проверку при обновлении прогресса (например, после сохранения SCORM progress) или по крону/задаче.

### 6.2. Функция checkCertificateEligibility

Сигнатура (пример):

```ts
checkCertificateEligibility(userId: string, courseId: string, courseScore?: number, courseStatus?: string): Promise<{ eligible: boolean; templateId?: string }>
```

- Найти шаблон по курсу (courseId). Если шаблонов несколько — приоритет по настройкам.
- Проверить: score >= template.minScore (если minScore задан), status === template.requiredStatus (если задан).
- Если eligible — вернуть templateId для создания сертификата.
- При создании записи: certNumber по формату (счётчик +1 или CERT-%ID%), expiryDate = issuedAt + validityDays (если задано).

### 6.3. Нумерация

- **Рекомендация из ТЗ:** простая стандартная нумерация (счётчик +1) как база. Вариант: глобальный счётчик в таблице или в настройках; при каждой выдаче +1 и подстановка в формат (например, CERT-0000123).
- Текущая реализация (ALT-{nanoid}) может остаться запасным вариантом при отсутствии шаблона.

---

## 7. Генерация PDF

- При запросе скачивания: загрузить сертификат и шаблон (и образ, если есть).
- Если у шаблона задана **подложка** (backgroundImageUrl): наложить на неё текст по **textMapping** (ФИО, дата, название курса, номер). Библиотека: @react-pdf/renderer с фоновым изображением.
- Если образа нет: использовать текущий макет по умолчанию (lib/certificates.tsx).
- **Доступность:** если у шаблона `allowUserDownload = false`, то для обычного пользователя не показывать кнопку «Скачать» и API download возвращать 403. Админ по-прежнему может скачивать (для контроля).

---

## 8. Интерфейсы

### 8.1. Админка

- **Настройка шаблонов:** форма: название, загрузка подложки (PNG/JPG/PDF), textMapping (координаты полей), привязка к курсу, minScore (%), requiredStatus, validityDays, формат нумерации, флаг «Электронная версия доступна пользователям».
- **Образы сертификатов:** каталог (название, превью), загрузка фона, редактирование textMapping (JSON или форма полей).
- **Ручная выдача:** модалка «Выдать сертификат»: выбор пользователя (поиск) и курса; проверка дубля (userId + courseId уже есть); создание записи с выбранным шаблоном курса.
- **Реестр:** таблица [Номер, Пользователь, Курс, Дата выдачи, Срок действия, Действия (Просмотр/Скачать/Аннулировать)] — без изменений по смыслу, при необходимости добавить колонку «Шаблон».
- **Массовая выдача:** по курсу с учётом условий шаблона (minScore, requiredStatus); только тех, у кого ещё нет сертификата по этому курсу.

### 8.2. Пользователь («Мои сертификаты»)

- Сетка карточек: название курса, дата выдачи, номер, при наличии срока — дата окончания.
- Кнопка **«Скачать PDF»** отображается только если в шаблоне сертификата включён флаг «Электронная версия доступна пользователям». Иначе — только текст «Сертификат выдан» без кнопки (или подсказка «доступен только в реестре»).

---

## 9. API

| Метод | Маршрут | Назначение |
|-------|---------|------------|
| GET | `/api/portal/certificates/[certId]/download` | Скачать PDF (на лету). Проверка: свой сертификат и allowUserDownload, либо админ. |
| GET | `/api/portal/admin/certificates/...` | Реестр (уже есть). |
| POST | `/api/portal/admin/certificates/generate` | Массовая выдача по курсу с учётом шаблона (уже есть; доработать под minScore/requiredStatus). |
| POST | `/api/portal/admin/certificates/issue` | Ручная выдача: тело { userId, courseId }; создание одной записи Certificate. |
| CRUD шаблонов (с загрузкой подложки) | `/api/portal/admin/certificate-templates` | Список, создание, обновление, удаление; POST/PATCH поддерживают multipart (файл подложки) и JSON. |

---

## 10. Этапы реализации

### Этап 1. Образы и шаблоны в БД

- [x] Модель **CertificateTemplate** с полями backgroundImageUrl, textMapping (подложка и координаты в шаблоне), courseId, minScore, requiredStatus, validityDays, numberingFormat, allowUserDownload.
- [ ] В **Certificate** добавить поля templateId, expiryDate; связь с CertificateTemplate.
- [ ] Миграция; при необходимости seed (один шаблон по умолчанию без образа).

### Этап 2. Админка: образы и шаблоны

- [ ] CRUD образов: загрузка фона (PNG/PDF), сохранение в storage или public; форма textMapping (JSON или поля x,y для Name, Date, CourseTitle, Number).
- [ ] CRUD шаблонов: название, курс, образ, minScore, requiredStatus, validityDays, формат нумерации, allowUserDownload.
- [ ] При выдаче (ручной и массовой) привязка к шаблону курса; расчёт expiryDate.

### Этап 3. Логика выдачи

- [ ] Реализовать **checkCertificateEligibility(userId, courseId, courseScore?, courseStatus?)** с учётом minScore и requiredStatus.
- [ ] Автоматическая выдача: при достижении условий (например, после обновления SCORM progress на 100% или статуса «Пройден») вызывать проверку и при eligible создавать Certificate с номером по шаблону (счётчик +1 или формат).
- [ ] Ручная выдача: модалка в админке (выбор пользователя и курса), API POST issue, создание записи с templateId и expiryDate.

### Этап 4. Генерация PDF по шаблону

- [ ] В lib/certificates: при наличии у сертификата template.image — загружать подложку и накладывать текст по textMapping (jsPDF или react-pdf с фоном).
- [ ] При отсутствии образа — текущий фиксированный макет.
- [ ] API download: проверка allowUserDownload для не-админа; при false — 403.

### Этап 5. Пользовательский интерфейс

- [ ] «Мои сертификаты»: карточки с курсом, датой выдачи, сроком действия (если есть). Кнопка «Скачать PDF» только если у шаблона allowUserDownload = true.
- [ ] Стиль: светлая тема, скруглённые карточки, золотые/primary кнопки, иконки Lucide (Download, Award).

### Этап 6. Реестр и полировка

- [ ] В реестре админки при необходимости колонка «Шаблон», «Срок действия». Массовая выдача с учётом условий шаблона курса.
- [ ] Документация (Support.md, Tasktracker).

---

## 11. Файлы для создания/изменения

| Файл | Действия |
|------|----------|
| `prisma/schema.prisma` | CertificateTemplate (backgroundImageUrl, textMapping, courseId, …); в Certificate — templateId, expiryDate. |
| `lib/certificates.tsx` или `lib/certificates/pdf.ts` | Генерация PDF с подложкой по textMapping; fallback на текущий макет. |
| `app/api/portal/admin/certificate-templates/route.ts` | GET list, POST (JSON или multipart с файлом подложки). |
| `app/api/portal/admin/certificate-templates/[id]/route.ts` | GET, PATCH (JSON или multipart), DELETE. |
| `app/api/portal/admin/certificates/issue/route.ts` | POST ручная выдача (userId, courseId). |
| `app/api/portal/admin/certificates/generate/route.ts` | Доработать: учёт шаблона курса, minScore, requiredStatus. |
| `app/api/portal/certificates/[certId]/download/route.ts` | Проверка allowUserDownload для роли user; генерация PDF из шаблона/образа. |
| `lib/certificates/eligibility.ts` | checkCertificateEligibility. |
| `app/portal/admin/certificates/` | Страница шаблонов и образов; модалка ручной выдачи; реестр без изменений или с колонками Шаблон/Срок. |
| `app/portal/student/certificates/page.tsx` | Условная кнопка «Скачать» по allowUserDownload. |
| `docs/Support.md` | Раздел «Сертификаты» (шаблоны, образы, ручная выдача, реестр). |
| `docs/Tasktracker.md` | Задачи этапа «Сертификаты» (доработка). |

---

## 12. Критерии приёмки (MVP)

- В админке есть настройка **образов** (фон + textMapping) и **шаблонов** (курс, minScore, requiredStatus, validityDays, нумерация, «Электронная версия доступна пользователям»).
- **Автоматическая выдача:** при достижении условий (minScore, requiredStatus) создаётся запись Certificate с templateId и expiryDate; нумерация — счётчик +1 или заданный формат.
- **Ручная выдача:** модалка выбора пользователя и курса, создание одной записи.
- **Реестр:** таблица выданных сертификатов (номер, пользователь, курс, дата, срок, действия).
- **Пользователь:** экран «Мои сертификаты» с карточками; кнопка «Скачать PDF» только если в шаблоне включён флаг доступности электронной версии.
- **Генерация PDF:** «на лету» при скачивании; при наличии образа — подложка + текст по textMapping; иначе — текущий макет по умолчанию.
- **Два процесса разделены:** выдача = запись в БД; генерация = создание PDF по запросу.
