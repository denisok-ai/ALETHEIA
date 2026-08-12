#!/usr/bin/env bash
# Сторож недоставленной почты: ловит отлупы (bounce) исходящих писем и шлёт
# Telegram-алерт админам с получателем и причиной.
#
# Зачем (инцидент Руденко, 22.07→разбор 12.08): приложение помечает письмо
# «sent», как только локальный Postfix принял его в очередь. Отлуп от Gmail
# («550 unauthenticated / no PTR») приходит АСИНХРОННО и в приложении не виден —
# клиент три недели не мог войти, а мы об этом не знали. Этот сторож закрывает
# весь класс: любой permanent-fail всплывает в Telegram в тот же час.
#
# Источник — логи контейнера Postfix (mailcow). Ищем status=bounced исходящих
# писем, дедуп по queue-id (чтобы не слать один отлуп повторно каждый запуск).
#
# Ставится cron'ом (см. install-aletheia-http-cron.sh / отдельный cron.d).
set -u

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
ENV_FILE="${ENV_FILE:-$PROD_ROOT/.env}"
STATE_DIR="/var/lib/aletheia-mail-bounce"
SEEN_FILE="$STATE_DIR/seen-ids"
LOG="/var/log/aletheia-mail-bounce.log"
POSTFIX_CONTAINER="${POSTFIX_CONTAINER:-mailcowdockerized-postfix-mailcow-1}"
# Смотрим назад с запасом относительно интервала cron (cron раз в 15 мин).
LOOKBACK="${LOOKBACK:-40m}"

mkdir -p "$STATE_DIR"
touch "$SEEN_FILE"

ts() { date -Iseconds; }

notify() {
  local text="$1" token proxy chat_ids
  token=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  # Telegram с сервера — только через прокси (HTTPS_PROXY, OpenConnect-egress).
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

# Свежие строки Postfix со status=bounced.
lines=$(docker logs --since "$LOOKBACK" "$POSTFIX_CONTAINER" 2>&1 | grep -E 'status=bounced' || true)
[ -z "$lines" ] && { echo "$(ts) no bounces" >> "$LOG"; exit 0; }

new_count=0
while IFS= read -r line; do
  # queue-id: слово перед первым двоеточием после имени процесса, вида 50D5F18AD57
  qid=$(echo "$line" | grep -oE '[A-F0-9]{9,}: to=<' | grep -oE '^[A-F0-9]{9,}')
  to=$(echo "$line" | grep -oE 'to=<[^>]+>' | head -1 | sed -E 's/to=<|>//g')
  [ -z "$qid" ] || [ -z "$to" ] && continue
  # свои внутренние адреса не считаем (интересуют письма клиентам)
  case "$to" in *@avaterra.pro) continue ;; esac
  grep -qxF "$qid" "$SEEN_FILE" && continue

  reason=$(echo "$line" | sed -E 's/.*status=bounced \(//; s/\)[[:space:]]*$//' | cut -c1-240)
  notify "⚠️ AVATERRA · Письмо НЕ доставлено
Кому: ${to}
Причина: ${reason}
Проверьте — возможно, клиент не получил доступ/пароль. Свяжитесь с ним или задайте пароль вручную (scripts/admin-set-user-password.ts)."
  echo "$qid" >> "$SEEN_FILE"
  new_count=$((new_count + 1))
  echo "$(ts) BOUNCE ${to} :: ${reason}" >> "$LOG"
done <<< "$lines"

# Обрезаем историю seen-id (последние 2000), чтобы файл не рос бесконечно.
if [ "$(wc -l < "$SEEN_FILE")" -gt 2000 ]; then
  tail -n 1000 "$SEEN_FILE" > "$SEEN_FILE.tmp" && mv "$SEEN_FILE.tmp" "$SEEN_FILE"
fi

echo "$(ts) processed, new alerts: ${new_count}" >> "$LOG"
