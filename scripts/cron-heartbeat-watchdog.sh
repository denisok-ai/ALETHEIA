#!/bin/bash
# Сторож фоновых задач: сообщает, если задача перестала ВЫПОЛНЯТЬСЯ вообще.
#
# Зачем отдельным скриптом, а не внутри приложения: сбой внутри задачи уже виден
# (алерты, ненулевой HTTP-код), а вот исчезновение /etc/cron.d/aletheia-http-cron
# после деплоя или рестарт-луп демона задач изнутри не детектируется — механизм,
# живущий в приложении, не может сообщить о собственной смерти. Тот же принцип,
# что и у scripts/uptime-watchdog.sh.
#
# Установка: раз в 30 минут в cron.
#   */30 * * * * root /opt/ALETHEIA/scripts/cron-heartbeat-watchdog.sh
set -uo pipefail

APP_ROOT="${APP_ROOT:-/opt/ALETHEIA}"
DB="${DB:-$APP_ROOT/prisma/dev.db}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"
STATE_FILE="${STATE_FILE:-/run/aletheia-cron-heartbeat.state}"
LOG="${LOG:-/var/log/aletheia-cron-heartbeat.log}"

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

# Ожидаемые интервалы (минуты) — держать в согласии с CRON_EXPECTED_INTERVAL_MIN
# в lib/cron-heartbeat.ts. Порог тревоги — два интервала.
declare -A EXPECTED=(
  [mailings-send]=5
  [inmail-sync]=15
  [installment-payments]=60
  [reconcile-enrollments]=10
  [paykeeper-health]=5
)

if [ ! -f "$DB" ]; then
  log "БД не найдена: $DB"
  exit 0
fi

now_s=$(date +%s)
stale_list=""

# Есть ли вообще хоть одна отметка: если система уже пишет их, то задача совсем
# без отметки — подозрительна. Именно так 19.07.2026 обнаружился мёртвый
# мониторинг PayKeeper: он не был внесён в расписание и «молчал» двое суток, а
# сторож его не видел, потому что отметки не было вовсе.
any_heartbeat=$(sqlite3 "$DB" "SELECT COUNT(*) FROM SystemSetting WHERE key LIKE 'cron_last_ok_%';" 2>/dev/null || echo 0)

for job in "${!EXPECTED[@]}"; do
  interval=${EXPECTED[$job]}
  # Отметка хранится в SystemSetting как ISO-строка
  iso=$(sqlite3 "$DB" "SELECT value FROM SystemSetting WHERE key='cron_last_ok_${job}';" 2>/dev/null)
  if [ -z "$iso" ]; then
    # Отметки нет. На свежем развёртывании это норма (никто ещё не отработал) —
    # тревожим только если другие задачи отметки уже пишут, то есть система
    # жива, а конкретно эта не запускается.
    if [ "${any_heartbeat:-0}" -gt 0 ]; then
      stale_list="${stale_list}\n· ${job}: не выполнялась ни разу (ожидается каждые ${interval} мин)"
    fi
    continue
  fi
  last_s=$(date -d "$iso" +%s 2>/dev/null || echo 0)
  [ "$last_s" -eq 0 ] && continue
  age_min=$(( (now_s - last_s) / 60 ))
  threshold=$(( interval * 2 ))
  if [ "$age_min" -gt "$threshold" ]; then
    stale_list="${stale_list}\n· ${job}: последний успех ${age_min} мин назад (ожидается каждые ${interval} мин)"
  fi
done

if [ -z "$stale_list" ]; then
  # Всё в норме: снимаем отметку о ранее отправленной тревоге, чтобы при
  # следующем сбое сообщение пришло сразу, а не после часа тишины.
  rm -f "$STATE_FILE"
  exit 0
fi

# Повторную тревогу — не чаще раза в час, иначе её перестанут читать.
if [ -f "$STATE_FILE" ]; then
  last_alert=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
  if [ $(( now_s - last_alert )) -lt 3600 ]; then
    exit 0
  fi
fi

token=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
chat=$(sqlite3 "$DB" "SELECT value FROM SystemSetting WHERE key='telegram_admin_chat_ids';" 2>/dev/null | cut -d, -f1 | tr -d ' ')
# Прокси обязателен: с этого сервера api.telegram.org напрямую не отвечает,
# без -x сообщение молча теряется (так был сломан uptime-watchdog).
proxy=$(grep -m1 '^HTTPS_PROXY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")

msg="⚠️ Фоновые задачи не выполняются:${stale_list}\n\nПроверьте /etc/cron.d/aletheia-http-cron и systemctl status aletheia-jobs."
log "ТРЕВОГА: $(echo -e "$stale_list" | tr '\n' ' ')"

if [ -n "$token" ] && [ -n "$chat" ]; then
  curl -sS --max-time 20 -o /dev/null ${proxy:+-x "$proxy"} \
    "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=$(echo -e "$msg")" || log "не удалось отправить тревогу в Telegram"
  echo "$now_s" > "$STATE_FILE"
else
  log "нет токена или chat_id — тревога не отправлена"
fi
