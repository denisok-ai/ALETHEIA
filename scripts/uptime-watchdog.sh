#!/bin/bash
# Независимый сторож доступности сайта.
#
# Зачем: мониторинг PayKeeper живёт ВНУТРИ приложения — если упало само приложение,
# он не запустится и никто не узнает (обнаружено 19.07.2026: в логе cron
# «Failed to connect to 127.0.0.1 port 3000», но алерта админам не было).
# Этот скрипт работает из cron, поэтому переживает падение приложения.
#
# Логика: тревога только после N подряд неудач (деплой сам по себе даёт 1–2 —
# ложные срабатывания не нужны), и отдельное сообщение при восстановлении.
#
# Установка: */5 * * * * root /opt/ALETHEIA/scripts/uptime-watchdog.sh
set -uo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
ENV_FILE="${ENV_FILE:-$PROD_ROOT/.env}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
STATE="/run/aletheia-uptime-fails"
LOG="/var/log/aletheia-uptime.log"
# 3 подряд × 5 мин = тревога после ~15 минут недоступности (деплой укладывается в 1–2)
THRESHOLD=3

code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo "000")
fails=$(cat "$STATE" 2>/dev/null || echo 0)
case "$fails" in ''|*[!0-9]*) fails=0 ;; esac

notify() {
  local text="$1"
  local token chat_ids proxy
  token=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  # ВАЖНО: Telegram с этого сервера доступен только через прокси (проверено 19.07.2026:
  # прямой запрос к api.telegram.org не проходит). Без -x тревоги молча не доставлялись бы.
  proxy=$(grep -m1 '^HTTPS_PROXY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  chat_ids=$(sqlite3 "$PROD_ROOT/prisma/dev.db" \
    "SELECT value FROM SystemSetting WHERE key='telegram_admin_chat_ids';" 2>/dev/null)
  [ -z "$token" ] && return 0
  IFS=',' read -ra ids <<< "$chat_ids"
  for id in "${ids[@]}"; do
    id=$(echo "$id" | tr -d ' ')
    [ -z "$id" ] && continue
    curl -sS --max-time 20 -o /dev/null \
      ${proxy:+-x "$proxy"} \
      "https://api.telegram.org/bot${token}/sendMessage" \
      -d "chat_id=${id}" --data-urlencode "text=${text}" || true
  done
}

if [ "$code" = "200" ]; then
  if [ "$fails" -ge "$THRESHOLD" ]; then
    echo "$(date -Iseconds) ВОССТАНОВЛЕН после $fails неудач" >> "$LOG"
    notify "✅ avaterra.pro снова доступен (был недоступен ~$((fails * 5)) мин)"
  fi
  echo 0 > "$STATE"
  exit 0
fi

fails=$((fails + 1))
echo "$fails" > "$STATE"
echo "$(date -Iseconds) НЕДОСТУПЕН (HTTP=$code), подряд: $fails" >> "$LOG"

# Тревога ровно на пороге — дальше молчим, чтобы не спамить каждые 5 минут
if [ "$fails" -eq "$THRESHOLD" ]; then
  notify "🔴 avaterra.pro не отвечает уже ~$((fails * 5)) мин (health HTTP=$code). Сервис: $(systemctl is-active aletheia 2>/dev/null)"
fi
exit 1
