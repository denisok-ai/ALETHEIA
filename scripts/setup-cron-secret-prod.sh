#!/bin/bash
# Одноразовая настройка CRON_SECRET на проде (если отсутствует).
set -euo pipefail
ENV_FILE=/opt/ALETHEIA/.env
BACKUP_DIR=/root/backups/security-20260710

mkdir -p "$BACKUP_DIR"
cp -a "$ENV_FILE" "$BACKUP_DIR/.env.before-cron-$(date +%H%M)"

if grep -q '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null; then
  echo "CRON_SECRET already present — skip append"
else
  SECRET=$(openssl rand -hex 32)
  echo "CRON_SECRET=$SECRET" >> "$ENV_FILE"
  echo "CRON_SECRET appended"
fi
chmod 600 "$ENV_FILE"

systemctl restart aletheia
sleep 5
echo "aletheia: $(systemctl is-active aletheia)"

SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2-)
NO_AUTH=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/cron/installment-payments)
BAD=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer wrong' http://127.0.0.1:3000/api/cron/installment-payments)
GOOD=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $SECRET" http://127.0.0.1:3000/api/cron/installment-payments)
HEALTH=$(curl -s --max-time 15 https://avaterra.pro/api/health)

echo "NO_AUTH=$NO_AUTH BAD=$BAD GOOD=$GOOD"
echo "health=$HEALTH"
