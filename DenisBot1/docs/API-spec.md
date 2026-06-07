<!--
@file: API-spec.md
@description: Контракты внутренних модулей и внешних интеграций Telegram/DeepSeak/KIE для MVP
@dependencies: docs/Project.md, docs/ER-diagram.md, docs/Security.md
@created: 2026-05-07
-->

# Avaterra Bot - API Specification (MVP)

## 1. Статусы и enum

### 1.1 Статусы планов и контента
- `content_plans.status`: `draft`, `ready`, `approved`, `active`, `archived`
- `content_items.status`: `draft`, `generated`, `quality_checked`, `scheduled`, `published`, `failed`, `cancelled`
- `publication_jobs.status`: `queued`, `running`, `retry_wait`, `done`, `failed`

### 1.2 Типы постов
- `content_items.post_type`: `info`, `sales`

### 1.3 Типы промптов
- `prompts.prompt_type`: `text_generation`, `title_variants`, `rewrite`, `image_generation`

## 2. Внутренние сервисные контракты

## 2.1 Planner Service
### Request
`POST /internal/plans/generate-week`
```json
{
  "project_id": "uuid",
  "week_start": "2026-05-11",
  "timezone": "Europe/Moscow",
  "force_regenerate": false
}
```

### Response
```json
{
  "plan_id": "uuid",
  "status": "ready",
  "items": [
    {
      "publish_date": "2026-05-11",
      "post_type": "info",
      "topic": "string",
      "objective": "string",
      "status": "draft"
    }
  ]
}
```

## 2.2 Text Generator Service
### Request
`POST /internal/content/generate-text`
```json
{
  "content_item_id": "uuid",
  "style": "expert",
  "max_chars": 1600,
  "with_title_variants": true
}
```

### Response
```json
{
  "content_item_id": "uuid",
  "generated_text": "string",
  "title_variants": ["string", "string"],
  "quality_score": 0.88
}
```

## 2.3 Image Generator Service
### Request
`POST /internal/content/generate-image`
```json
{
  "content_item_id": "uuid",
  "prompt_profile": {
    "style": "cinematic",
    "composition": "center_subject",
    "format": "4:5",
    "negative_prompt": "text, letters, numbers, logo, watermark, banner"
  }
}
```

### Response
```json
{
  "content_item_id": "uuid",
  "provider_task_id": "string",
  "status": "queued"
}
```

## 2.4 Publisher Service
### Request
`POST /internal/publish/schedule`
```json
{
  "content_item_id": "uuid",
  "publish_at": "2026-05-11T10:00:00+03:00",
  "idempotency_key": "projectId:date:postType"
}
```

### Response
```json
{
  "job_id": "uuid",
  "status": "queued"
}
```

## 3. Внешние интеграции

## 3.1 Telegram Bot API
### Использование
- команды админа;
- отправка текста и изображения в канал;
- callback queries из inline-кнопок.

### Ключевые методы
- `sendMessage`
- `sendPhoto`
- `editMessageText`
- `answerCallbackQuery`
- `getChat`

### Правила
- webhook secret token обязателен в production;
- `chat_id` канала проверяется на этапе онбординга;
- повторная публикация блокируется через `idempotency_key`.

## 3.2 DeepSeak API
### Request contract (обобщенный)
```json
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "brand constraints"},
    {"role": "user", "content": "task prompt"}
  ],
  "temperature": 0.7,
  "max_tokens": 1200
}
```

### Response contract (обобщенный)
```json
{
  "id": "string",
  "choices": [
    {"message": {"content": "generated text"}}
  ],
  "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
}
```

### Надежность
- retry: до 5 попыток, exponential backoff + jitter;
- timeout каждого запроса: 30 сек;
- логировать только метаданные и `request_id`, без текстов с персональными данными.

## 3.3 KIE API (асинхронный)
### Submit request
```json
{
  "prompt": "image prompt",
  "negative_prompt": "text, logo, watermark, letters, numbers",
  "size": "1024x1280"
}
```

### Submit response
```json
{
  "task_id": "string",
  "status": "queued"
}
```

### Polling response
```json
{
  "task_id": "string",
  "status": "done",
  "image_url": "https://..."
}
```

### Правила
- polling интервал: 5-10 секунд;
- общий лимит ожидания: 120 секунд;
- если `status=failed`, переводить `content_items.status=failed` и уведомлять админа.

## 4. Ошибки и коды

### 4.1 Единый формат ошибки
```json
{
  "error": {
    "code": "EXTERNAL_API_TIMEOUT",
    "message": "KIE polling timeout",
    "request_id": "uuid"
  }
}
```

### 4.2 Основные коды
- `VALIDATION_ERROR`
- `UNAUTHORIZED_ADMIN`
- `EXTERNAL_API_TIMEOUT`
- `EXTERNAL_API_RATE_LIMIT`
- `DUPLICATE_PUBLICATION_BLOCKED`
- `CONTENT_QUALITY_REJECTED`

## 5. Идемпотентность
- Ключ публикации: `project_id + publish_date + post_type`.
- Повторные запросы `schedule` возвращают существующий `job_id`.
- Для воркера публикации используется distributed lock в Redis.
