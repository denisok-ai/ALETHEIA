<!--
@file: Session-Handoff-2026-05-22.md
@description: Handoff после внедрения режима admin_preview, фиксов дублей и настройки логирования (7 дней)
@dependencies: docs/Project.md, docs/Logging.md, docs/changelog.md, docs/Diary.md, docs/Tasktracker.md
@created: 2026-05-22
-->

# Session Handoff — 2026-05-22

Документ для следующих доработок: что сделано, как устроено, где смотреть, как откатить.

## 1. Режим публикации (текущий боевой)

**Временный режим:** предпросмотр админам в личку, без автопоста в канал и без генерации картинок.

| Переменная | Значение на проде | Назначение |
|------------|-------------------|------------|
| `PUBLISH_MODE` | `admin_preview` | `channel` — в канал; `admin_preview` — текст админам |
| `IMAGE_GENERATION_ENABLED` | `false` | KIE не вызывается, пост → `ready` без `image_url` |
| `ADMIN_TELEGRAM_IDS` | `337952743,368722371,459494305` | ACL бота + базовый список |
| `ADMIN_PREVIEW_EXCLUDE_IDS` | `8660626182,7679088857` | Не слать предпросмотр: бот Avaterra, PostX |

### Кто получает предпросмотр в 11:00 МСК

`admin_preview_recipient_ids` = `ADMIN_TELEGRAM_IDS` − `ADMIN_PREVIEW_EXCLUDE_IDS`:

| ID | Имя (Telegram) |
|----|----------------|
| 337952743 | Denis / Сосин Денис |
| 368722371 | Vlad Sumkin |
| 459494305 | Татьяна |

**Не получают:** PostX (`7679088857`), бот `@AvaterraBot` (`8660626182`).

### Формат сообщения предпросмотра

```
Пост на проверку
Дата: YYYY-MM-DD | Тип: <post_type>
Тема: <topic>

<текст поста>
```

Без футера «Опубликуйте в канале…», без `/stat`, без UUID в теле.

### Расписание

- Cron **не менялся**: `mon..sun 11:00` (`Europe/Moscow`), job `content_publisher_daily`.
- Цепочка: `_run_publisher_slot` → `run_publisher_preflight` → `publish_due_today` → `publish_item`.
- Выбор поста: **только** `content_items` с `publish_date = сегодня` и `status IN (approved, ready)`.

### Статусы в БД

| Статус | Смысл |
|--------|--------|
| `ready` / `approved` | Ждёт слота 11:00 |
| `admin_preview_sent` | Текст ушёл админам, в канал не публиковался |
| `published` | Был автопост в канал (старые посты до режима) |

### Защита от дублей и «старых» постов

Реализовано в `channel_publisher.publish_item`:

1. `publish_date` должен совпадать с «сегодня» в `TZ` — иначе `skipped` / `wrong_publish_date`.
2. Повторно не шлём, если уже `admin_preview_sent`.
3. Лог `publisher_due_items` — какие `item_id` / `post_type` уходят в слот.

**Инцидент 20–21.05:** тест `scripts/send_admin_preview_test.py` брал **самый ранний** `ready` (не сегодня) + `--reset-status` → дубль. Скрипт исправлен: только пост на **сегодня**.

### Откат к автопубликации в канал

```bash
PUBLISH_MODE=channel
IMAGE_GENERATION_ENABLED=true
ENABLE_AUTO_PUBLISH=true
DRY_RUN=false
TARGET_CHANNEL_ID=<id канала>
docker compose -f /opt/avaterra-bot/docker-compose.yml up -d --force-recreate bot
```

После смены `.env` обязателен **`--force-recreate bot`** (не только `restart`), иначе контейнер держит старые переменные.

## 2. Ключевые файлы кода

| Файл | Что менять при доработках |
|------|---------------------------|
| `src/avaterra_bot/config.py` | `PUBLISH_MODE`, `IMAGE_GENERATION_ENABLED`, `admin_preview_recipient_ids` |
| `src/avaterra_bot/services/publisher/channel_publisher.py` | `publish_item`, `_send_admin_preview`, `_format_admin_preview_message` |
| `src/avaterra_bot/services/generator/image_generator.py` | early exit при `IMAGE_GENERATION_ENABLED=false` |
| `src/avaterra_bot/workers/content_worker.py` | cron 11:00, `publisher_run_state` / `publisher_run_done` |
| `src/avaterra_bot/bot/handlers/admin.py` | `/publish_now` |
| `scripts/send_admin_preview_test.py` | ручной прогон предпросмотра **только на сегодня** |

## 3. Тесты

```bash
PYTHONPATH=src pytest tests/test_publisher_admin_preview.py tests/test_image_generation_disabled.py -q
```

## 4. Деплой и сервер

- Каталог: `/opt/avaterra-bot`
- Деплой: `DEPLOY_HOST=avaterra bash deploy/deploy.sh`
- Секреты: только `/opt/avaterra-bot/.env` (не в git)
- SSH-алиас: `avaterra` (`docs/Deployment.md`)

### Полезные команды

```bash
# Логи слота публикации
docker compose -f /opt/avaterra-bot/docker-compose.yml logs --since 24h bot | grep -E 'publisher_due_items|admin_preview'

# Посты на дату
docker compose exec postgres psql -U avaterra -d avaterra -c \
  "SELECT publish_date, post_type, status FROM content_items WHERE publish_date >= CURRENT_DATE ORDER BY publish_date;"

# Ручной предпросмотр (в контейнере, скрипт через docker cp)
docker cp /opt/avaterra-bot/scripts/send_admin_preview_test.py avaterra-bot:/tmp/
docker compose exec bot python /tmp/send_admin_preview_test.py
```

## 5. Логирование проекта

- Журнал решений: `docs/Diary.md` (по датам).
- История изменений: `docs/changelog.md`.
- Задачи: `docs/Tasktracker.md`.
- Спецификация логов: `docs/Logging.md`.
- **Хранение логов: не более 7 дней** (см. `LOG_RETENTION_DAYS`, logrotate, Docker `max-file`).

## 6. Открытые моменты

- Админ `459494305` должен нажать **Start** в @AvaterraBot, иначе Telegram: `Forbidden: bot can't initiate conversation`.
- Посты, уже ушедшие в канал до 20.05 (`status=published`), в предпросмотр не попадают — это ожидаемо.
- `/stat` после ручной публикации в канале — по желанию админа; в текст предпросмотра больше не вставляется.

## 7. Недельный ритм постов (7/нед)

| День | post_type |
|------|-----------|
| Пн | educational |
| Вт | pain |
| Ср | practice |
| Чт | author |
| Пт | faq |
| Сб | course |
| Вс | reflection |

Планер: воскресенье 19:00 МСК (`content_planner_weekly`).
