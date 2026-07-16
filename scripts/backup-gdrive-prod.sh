#!/bin/bash
# Ежедневный бэкап прода в Google Drive (rclone remote "gdrive").
# Содержимое: SQLite БД (snapshot), .env, nginx-конфиги, cron, systemd-юниты —
# в tar.gz, зашифрованный gpg AES256 (passphrase: /root/.backup-passphrase).
# По воскресеньям дополнительно rclone sync public/uploads (SCORM/медиа) — инкрементально.
# Ротация: Google Drive — 10 дней (daily), локальный staging — 7 дней.
#
# Установка: см. scripts/setup-backup-gdrive-prod.sh
# Восстановление архива:
#   rclone copy gdrive:avaterra-backups/daily/aletheia-<TS>.tar.gz.gpg .
#   gpg --batch --passphrase-file /root/.backup-passphrase -d aletheia-<TS>.tar.gz.gpg | tar -xz
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ALETHEIA}"
REMOTE="${REMOTE:-gdrive:avaterra-backups}"
STAGE="${STAGE:-/root/backups/gdrive-staging}"
PASSFILE="${PASSFILE:-/root/.backup-passphrase}"

TS=$(date +%Y%m%d-%H%M)
mkdir -p "$STAGE"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# 1) SQLite: консистентный снапшот через .backup (не cp — файл может писаться)
sqlite3 "$APP_ROOT/prisma/dev.db" ".backup $WORK/dev.db"

# 2) Важные настройки
cp "$APP_ROOT/.env" "$WORK/env"
cp /etc/nginx/sites-available/aletheia "$WORK/nginx-aletheia.conf" 2>/dev/null || true
cp /etc/nginx/conf.d/aletheia-cache-maps.conf "$WORK/" 2>/dev/null || true
mkdir -p "$WORK/cron.d" && cp /etc/cron.d/aletheia-* "$WORK/cron.d/" 2>/dev/null || true
mkdir -p "$WORK/systemd" && cp /etc/systemd/system/aletheia*.service "$WORK/systemd/" 2>/dev/null || true

# 3) Архив + шифрование (секреты .env не должны попадать в облако открытыми)
tar -czf "$WORK/aletheia-$TS.tar.gz" -C "$WORK" dev.db env nginx-aletheia.conf cron.d systemd 2>/dev/null \
  || tar -czf "$WORK/aletheia-$TS.tar.gz" -C "$WORK" dev.db env
gpg --batch --yes --symmetric --cipher-algo AES256 \
  --passphrase-file "$PASSFILE" \
  -o "$STAGE/aletheia-$TS.tar.gz.gpg" "$WORK/aletheia-$TS.tar.gz"

# 4) В Google Drive
rclone copy "$STAGE/aletheia-$TS.tar.gz.gpg" "$REMOTE/daily/" --quiet

# 5) Еженедельно (воскресенье): uploads — SCORM-курсы, медиатека, обложки
if [ "$(date +%u)" = "7" ]; then
  rclone sync "$APP_ROOT/public/uploads" "$REMOTE/uploads" --quiet || echo "WARN: uploads sync failed"
fi

# 6) Ротация
rclone delete "$REMOTE/daily" --min-age 10d --quiet || true
find "$STAGE" -name "*.gpg" -mtime +7 -delete

echo "OK aletheia-$TS.tar.gz.gpg -> $REMOTE/daily/"
