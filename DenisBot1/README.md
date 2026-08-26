# Avaterra Telegram SMM Bot

Telegram-бот для автоматизации SMM и маркетинга курса
[avaterra.pro](https://avaterra.pro/): анализ сайта, недельный
контент-план, генерация постов и изображений, публикация по
расписанию (Пн/Ср/Пт), воронка продаж и аналитика.

## Документация

- [docs/Project.md](docs/Project.md) — архитектура и требования.
- [docs/API-spec.md](docs/API-spec.md) — внутренние и внешние контракты.
- [docs/ER-diagram.md](docs/ER-diagram.md) — модель данных.
- [docs/Roadmap.md](docs/Roadmap.md) — план спринтов.
- [docs/Security.md](docs/Security.md) — политика безопасности.
- [docs/Logging.md](docs/Logging.md) — структура логов и ротация.
- [docs/Deployment.md](docs/Deployment.md) — деплой и бэкапы.
- [docs/Deduplication.md](docs/Deduplication.md) — антидубли контента.
- [docs/Tasktracker.md](docs/Tasktracker.md) — спринты и задачи.
- [docs/Diary.md](docs/Diary.md) — журнал решений.
- [docs/qa.md](docs/qa.md) — открытые вопросы.
- [docs/changelog.md](docs/changelog.md) — журнал изменений.
- [docs/Session-Handoff-2026-05-22.md](docs/Session-Handoff-2026-05-22.md) — режим admin_preview, env, откат, команды.

## Быстрый старт (локально)

```bash
cp .env.example .env
docker compose up -d --build
```

## Деплой

```bash
deploy/deploy.sh
```

Скрипт делает бэкап текущей версии, выкатывает новый код,
запускает миграции и перезапускает сервис.

## Структура проекта

```
src/avaterra_bot/
  bot/            # aiogram handlers и middleware
  db/             # подключение, миграции, репозитории
  services/       # планировщик, дедубликация, publisher
  integrations/   # DeepSeek, KIE, Telegram-клиенты
  workers/        # фоновые задачи и scheduler
  config.py       # настройки из ENV
  logging_setup.py
deploy/           # deploy.sh, backup.sh, systemd, logrotate
migrations/       # SQL миграции
tests/            # unit-тесты
```
