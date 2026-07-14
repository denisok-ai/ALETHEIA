#!/usr/bin/env bash
# Мониторинг Telegram на VPS: прокси для исходящих (бот — long-polling, webhook не используется).
# Cron (опционально, каждые 5 мин):
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
read -r PENDING URL <<<"$(python3 -c "
import json,sys
d=json.loads(sys.argv[1])
r=d.get('result') or {}
print(r.get('pending_update_count',0), (r.get('url') or '')[:80])
" "$WH")"

echo "$(date -Is) mode=polling pending=$PENDING webhook_url=${URL:-empty}"

if [[ -n "${URL:-}" ]]; then
  echo "$(date -Is) WARN: webhook still set — deleting (poll worker is primary)"
  npx tsx scripts/telegram-delete-webhook.ts 2>&1 | tail -3
fi

if systemctl is-active --quiet aletheia-telegram-poll.service 2>/dev/null; then
  echo "$(date -Is) poll_worker=active"
else
  RESTART_COOLDOWN=/var/run/aletheia-telegram-poll-restart.ts
  now=$(date +%s)
  last=0
  [[ -f "$RESTART_COOLDOWN" ]] && last=$(stat -c %Y "$RESTART_COOLDOWN" 2>/dev/null || echo 0)
  if (( now - last > 1800 )); then
    echo "$(date -Is) WARN: aletheia-telegram-poll.service not active — restarting"
    systemctl restart aletheia-telegram-poll.service 2>/dev/null || true
    touch "$RESTART_COOLDOWN"
  else
    echo "$(date -Is) WARN: poll inactive but restart cooldown active (${last})"
  fi
fi

# Прокси для исходящих — рестарт только outline; poll не трогаем (иначе каждые 5 мин при blip прокси).
if [[ -n "$PROXY" ]]; then
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 8 -x "$PROXY" https://api.telegram.org/ || echo "000")
  if [[ "$CODE" != "302" && "$CODE" != "200" ]]; then
    echo "$(date -Is) WARN: proxy $PROXY telegram http=$CODE — restart outline only"
    systemctl restart outline-ss-local outline-telegram-proxy 2>/dev/null || true
  fi
fi
