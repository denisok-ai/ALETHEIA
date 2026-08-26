<!--
@file: Logging.md
@description: Структура логирования Avaterra-бота, ротация и анализ ошибок
@dependencies: src/avaterra_bot/logging_setup.py, deploy/logrotate/avaterra-bot
@created: 2026-05-07
-->

# Avaterra Bot - Logging

## 1. Цели
- Иметь единый формат логов для быстрой диагностики.
- **Не хранить логи дольше 7 дней** (1 неделя) — ни в приложении, ни на диске, ни в Docker.
- Вести проектный журнал в `docs/Diary.md` и `docs/changelog.md`; для крупных сессий — `docs/Session-Handoff-*.md`.
- Никогда не писать секреты и токены в логи.

## 2. Уровни и категории
- `DEBUG`: только при `LOG_LEVEL=DEBUG`, для разработчиков.
- `INFO`: бизнес-события (старт сервиса, постановка задач, публикация поста).
- `WARNING`: восстановимые проблемы (ретрай, лимит провайдера, повторная попытка).
- `ERROR`: операция не выполнена, требует внимания.
- `CRITICAL`: сбой компонента, недоступность ключевой подсистемы.

## 3. Формат
Структурный JSON со следующими обязательными полями:
- `timestamp`
- `level`
- `name` (logger)
- `message`
- произвольные поля (`request_id`, `provider`, `latency_ms`, `error_code` и т.д.).

Пример:
```json
{"timestamp":"2026-05-07T10:00:00","level":"INFO","name":"avaterra_bot.services.publisher","message":"post_published","content_item_id":"...","latency_ms":420}
```

## 4. Маскирование секретов
- Реализовано в `SecretMaskingFilter` (`logging_setup.py`).
- Маскируются:
  - значения по ключам `authorization`, `token`, `api_key`, `password`, `secret`;
  - паттерны `sk-...`, токены вида `12345678:AAA...`, `Bearer ...`.
- Любые новые секреты добавлять в фильтр немедленно.

## 5. Ротация (максимум 7 дней)

Единая политика: **`LOG_RETENTION_DAYS=7`** в `.env` управляет `backupCount` в приложении; logrotate и Docker согласованы с тем же сроком.

### Внутри приложения
- `TimedRotatingFileHandler`: ежедневно в полночь, `backupCount=LOG_RETENTION_DAYS` (default **7**).
- Файлы: `logs/app.log`, `logs/app.log.YYYY-MM-DD`.
- При старте пишется `logging_initialized` с полем `retention_days`.

### На уровне ОС
- `logrotate` (`deploy/logrotate/avaterra-bot`):
  - daily, **rotate 7**, compress, copytruncate, **maxage 7**.
  - покрывает `/opt/avaterra-bot/logs/*.log` и docker volume логов.

### Docker
- `json-file` driver: `max-size=20m`, **`max-file=7`** для контейнера бота (~неделя при ежедневной ротации драйвера).
- БД и Redis: `max-size=10m`, `max-file=5`.

### Проверка на сервере

```bash
ls -la /opt/avaterra-bot/logs/
docker compose -f /opt/avaterra-bot/docker-compose.yml logs --tail=50 bot | grep logging_initialized
```

## 6. Анализ
- Быстрый поиск ошибок: `grep '"level":"ERROR"' logs/app.log`.
- По провайдеру: `grep '"provider":"deepseek"' logs/app.log | jq '.'`.
- По заданию публикации: `grep "<idempotency_key>" logs/app.log`.

## 7. Журналирование проекта (не путать с файлами `logs/`)

| Файл | Когда обновлять |
|------|-----------------|
| `docs/changelog.md` | Каждая значимая выкладка / hotfix |
| `docs/Diary.md` | Решения, инциденты, откат |
| `docs/Tasktracker.md` | Статус задач и чеклисты |
| `docs/Session-Handoff-*.md` | Крупная сессия: режимы, env, файлы, команды |
| `docs/Project.md` | Архитектурные изменения |

Актуальный handoff по режиму `admin_preview`: **`docs/Session-Handoff-2026-05-22.md`**.

## 8. Чек-лист дисциплины логов
- [ ] Не логировать тело запросов с пользовательскими данными.
- [ ] Не логировать значения env.
- [ ] Логировать `request_id` для трассировки.
- [ ] Использовать `extra={...}` вместо склейки строк.
- [ ] Ключевые события публикатора: `publisher_due_items`, `admin_preview_sent`, `publisher_run_done`.
