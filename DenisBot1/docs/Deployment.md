<!--
@file: Deployment.md
@description: Процесс выкладки Avaterra-бота с автоматическими бэкапами и ротацией версий
@dependencies: deploy/deploy.sh, deploy/backup.sh, deploy/restore.sh, deploy/install-on-server.sh
@created: 2026-05-07
-->

# Avaterra Bot - Deployment

## 1. Целевая модель
- Сервер с Docker и docker compose.
- Каталог приложения: `/opt/avaterra-bot`.
- Каталог бэкапов: `/var/backups/avaterra-bot`.
- Запуск через systemd unit `avaterra-bot.service`.

## 2. Первичная установка
1. Залогиниться на сервер (по SSH-ключу).
2. Создать каталог и положить `.env` с реальными секретами: `/opt/avaterra-bot/.env`.
3. Выполнить `deploy/install-on-server.sh` (ставит Docker, systemd unit, logrotate).

## 3. Регулярная выкладка
Запускается с локальной машины разработчика:

```bash
DEPLOY_HOST=avaterra bash deploy/deploy.sh
```

`avaterra` - алиас в `~/.ssh/config`, ссылающийся на ключ
`~/.ssh/avaterra_deploy_ed25519` и хост сервера (root login пока,
с авторизацией только по ключу).

Алгоритм:
1. Создается удаленный каталог при необходимости.
2. Запускается `deploy/backup.sh` на сервере (бэкап текущей версии и БД).
3. Через `rsync` синхронизируется код (без `.env`, логов, бэкапов).
4. Перестраиваются и запускаются контейнеры через docker compose.
5. Печатается статус контейнеров.

## 4. Бэкапы
- Скрипт: `deploy/backup.sh`.
- Содержимое:
  - архив каталога приложения `app.tar.gz` (без `logs/`, `runtime/`, `backups/`);
  - `pg_dump` PostgreSQL в `postgres.sql.gz`.
- Расположение: `/var/backups/avaterra-bot/<UTC-timestamp>/`.
- Ротация: автоматически удаляются папки старше 7 дней.

Регулярный запуск через systemd timer:
- `avaterra-backup.timer` запускает `avaterra-backup.service` ежедневно в 03:30.

## 5. Откат версии
```bash
APP_DIR=/opt/avaterra-bot deploy/restore.sh <timestamp>
```
- Останавливает контейнеры.
- Распаковывает архив приложения.
- Поднимает контейнеры.
- Восстанавливает дамп БД.

## 6. Проверки после деплоя
- `docker compose ps` - контейнеры в `healthy`.
- Логи: `docker compose logs --tail=200 bot`.
- Файловые логи: `/opt/avaterra-bot/logs/app.log`.
- Алерт от бота администратору о старте.

## 7. Безопасность процесса
- Доступ по SSH-ключу, без пароля.
- `.env` хранится только на сервере, не передается через rsync.
- Бэкапы хранятся вне каталога приложения.
- При обнаружении секрета в репозитории - ротация ключей и форсированный backup перед чисткой.
