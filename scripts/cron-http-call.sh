#!/bin/bash
# Вызов защищённого HTTP cron-маршрута Next.js с Bearer CRON_SECRET из .env.
# Использование: cron-http-call.sh <endpoint>
#   endpoint: mailings-send | inmail-sync | installment-payments | reconcile-enrollments | blog-telegram-sync | paykeeper-health | nudge-inactive-enrollees | content-integrity | blog-announce
set -euo pipefail

ENDPOINT="${1:-}"
if [ -z "$ENDPOINT" ]; then
  echo "usage: cron-http-call.sh <endpoint>" >&2
  exit 2
fi

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
ENV_FILE="${ENV_FILE:-$PROD_ROOT/.env}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
LOG="/var/log/aletheia-cron-${ENDPOINT}.log"

CRON_SECRET=$(grep -m1 '^CRON_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
if [ -z "$CRON_SECRET" ]; then
  echo "$(date -Iseconds) ${ENDPOINT} ERROR: CRON_SECRET missing in $ENV_FILE" >> "$LOG"
  exit 1
fi

TMP="/tmp/aletheia-cron-${ENDPOINT}.json"
code=$(curl -sS --max-time 120 -o "$TMP" -w '%{http_code}' \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${BASE_URL}/api/cron/${ENDPOINT}" 2>>"$LOG" || echo "000")

echo "$(date -Iseconds) ${ENDPOINT} HTTP=${code}" >> "$LOG"
if [ "$code" != "200" ]; then
  head -c 2000 "$TMP" >> "$LOG" 2>/dev/null || true
  echo >> "$LOG"
  exit 1
fi
