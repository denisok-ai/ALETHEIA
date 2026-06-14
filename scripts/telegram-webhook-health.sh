#!/usr/bin/env bash
# Мониторинг webhook Telegram: pending updates и last_error → авто setWebhook.
# Cron на VPS (каждые 5 мин):
#   */5 * * * * root /opt/ALETHEIA/scripts/telegram-webhook-health.sh >> /var/log/telegram-webhook-health.log 2>&1
set -euo pipefail
cd /opt/ALETHEIA
set -a
# shellcheck disable=SC1091
source .env
set +a

PROXY="${HTTPS_PROXY:-${HTTP_PROXY:-}}"
PROXY_ARG=()
[[ -n "$PROXY" ]] && PROXY_ARG=(--proxy "$PROXY")

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "$(date -Is) SKIP: no TELEGRAM_BOT_TOKEN"
  exit 0
fi

WH=$(curl -sS --connect-timeout 15 "${PROXY_ARG[@]}" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" || echo '{"ok":false}')
read -r PENDING LAST_ERR <<<"$(python3 -c "
import json,sys
d=json.loads(sys.argv[1])
r=d.get('result') or {}
print(r.get('pending_update_count',0), (r.get('last_error_message') or '').replace(' ','_')[:80])
" "$WH")"

echo "$(date -Is) pending=$PENDING last_error=${LAST_ERR:-none}"

NEED_RESET=0
if [[ "${PENDING:-0}" -gt 3 ]]; then NEED_RESET=1; fi
if echo "${LAST_ERR:-}" | grep -qiE 'timeout|timed_out|connection'; then NEED_RESET=1; fi

if [[ "$NEED_RESET" -eq 1 ]]; then
  echo "$(date -Is) RESET: setWebhook без drop_pending (сообщения подхватит poll-worker)"
  npx tsx scripts/telegram-webhook-reset-soft.ts 2>&1 | tail -8
fi

# Прокси для исходящих
if [[ -n "$PROXY" ]]; then
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 8 -x "$PROXY" https://api.telegram.org/ || echo "000")
  if [[ "$CODE" != "302" && "$CODE" != "200" ]]; then
    echo "$(date -Is) WARN: proxy $PROXY telegram http=$CODE — restart outline"
    systemctl restart outline-ss-local outline-telegram-proxy 2>/dev/null || true
    systemctl restart aletheia 2>/dev/null || true
  fi
fi
