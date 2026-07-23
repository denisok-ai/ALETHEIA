#!/usr/bin/env bash
# Ежедневная самопроверка прода с тревогой в Telegram.
#
# Написана к отпуску владельца (июль 2026): две недели никто не смотрит на
# сайт, поэтому всё, что может сломаться незаметно, должно кричать само.
# Молчание — норма: сообщение уходит ТОЛЬКО при проблеме, плюс по понедельникам
# короткое «всё в порядке», чтобы было видно, что сам канал тревог жив.
#
# Ограничение честно зафиксировано: скрипт работает на том же сервере, что и
# сайт, — полное выключение сервера он не поймает. От этого защищает только
# оплаченный хостинг (инцидент 20.07.2026 — 502 из-за неоплаты).
#
# Установка: scp на сервер в /usr/local/bin/ + строка в /etc/cron.d (см. Deploy.md).
set -uo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
ENV_FILE="$DEPLOY_ROOT/.env"
DB="$DEPLOY_ROOT/prisma/dev.db"
BASE="https://avaterra.pro"
PROBLEMS=()

check() { # check <название> <команда…>; провал добавляет строку в PROBLEMS
  local name="$1"; shift
  if ! "$@" >/dev/null 2>&1; then PROBLEMS+=("$name"); fi
}

# 1. Приложение и БД — через публичный URL, то есть весь путь nginx→next→sqlite.
health=$(curl -sS --max-time 25 "$BASE/api/health" 2>/dev/null || true)
echo "$health" | grep -q '"ok":true' || PROBLEMS+=("health: приложение или БД не отвечает")
echo "$health" | grep -q '"database":"ok"' || PROBLEMS+=("health: база недоступна")

# 2. Главная страница отвечает 200.
[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$BASE/" 2>/dev/null)" = "200" ] \
  || PROBLEMS+=("главная не отдаёт 200")

# 3. robots.txt: карта сайта указывает на боевой домен (инцидент с localhost 20.07).
robots=$(curl -sS --max-time 20 "$BASE/robots.txt" 2>/dev/null || true)
echo "$robots" | grep -q "Sitemap: $BASE/sitemap.xml" || PROBLEMS+=("robots.txt: нет строки Sitemap на боевой домен")
echo "$robots" | grep -qiE "localhost|127\.0\.0\.1" && PROBLEMS+=("robots.txt: снова localhost")

# 4. sitemap.xml не падает (ловили спорадические 500).
[ "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$BASE/sitemap.xml" 2>/dev/null)" = "200" ] \
  || PROBLEMS+=("sitemap.xml не отдаёт 200")

# 5. Сервисы стека.
for s in aletheia nginx aletheia-telegram-poll aletheia-jobs docker; do
  systemctl is-active --quiet "$s" || PROBLEMS+=("сервис $s не запущен")
done

# 6. Диск: 85% — порог, после которого SQLite и логи начнут страдать.
usage=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "${usage:-0}" -lt 85 ] || PROBLEMS+=("диск заполнен на ${usage}%")

# 7. Почтовая очередь: рост означает, что исходящие письма не доставляются.
# Не `|| echo 0`: grep -c при нуле совпадений и так печатает «0», но выходит
# с кодом 1 — добавка echo давала «0\n0» и ломала числовое сравнение.
qcount=$(docker exec "$(docker ps -qf name=postfix-mailcow)" postqueue -p 2>/dev/null | grep -c '^[0-9A-F]')
qcount=$(printf '%s' "$qcount" | head -1 | tr -dc '0-9')
[ "${qcount:-0}" -lt 20 ] || PROBLEMS+=("почтовая очередь: $qcount писем зависло")

# 8. SSL: certbot обновляет сам, но если он сломается — узнать за 10 дней, а не по факту.
end=$(echo | openssl s_client -connect avaterra.pro:443 -servername avaterra.pro 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [ -n "$end" ]; then
  left_days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
  [ "$left_days" -ge 10 ] || PROBLEMS+=("SSL истекает через $left_days дн.")
else
  PROBLEMS+=("SSL: не удалось прочитать сертификат")
fi

# 9. Бэкап на Google Drive был за последние 26 часов.
if ! find /var/log/aletheia-backup.log -newermt "26 hours ago" 2>/dev/null | grep -q . \
   || ! tail -1 /var/log/aletheia-backup.log 2>/dev/null | grep -q '^OK'; then
  PROBLEMS+=("бэкап в Google Drive не подтверждён за 26 ч")
fi

send_telegram() { # тот же канал, что у cron-heartbeat-watchdog: бот + прокси
  local text="$1"
  local token chat proxy
  token=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  chat=$(sqlite3 "$DB" "SELECT value FROM SystemSetting WHERE key='telegram_admin_chat_ids';" 2>/dev/null | cut -d, -f1 | tr -d ' ')
  proxy=$(grep -m1 '^HTTPS_PROXY=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  [ -n "$token" ] && [ -n "$chat" ] || return 1
  curl -sS --max-time 20 -o /dev/null ${proxy:+-x "$proxy"} \
    "https://api.telegram.org/bot${token}/sendMessage" \
    --data-urlencode "chat_id=${chat}" \
    --data-urlencode "text=${text}"
}

if [ "${#PROBLEMS[@]}" -gt 0 ]; then
  msg="⚠️ avaterra.pro: самопроверка нашла проблемы:"
  for p in "${PROBLEMS[@]}"; do msg="$msg
— $p"; done
  send_telegram "$msg"
  echo "FAIL: ${#PROBLEMS[@]} проблем"; printf '%s\n' "${PROBLEMS[@]}"
  exit 1
fi

# Понедельник — короткий сигнал «жив»: тишина в остальные дни не двусмысленна.
if [ "$(date +%u)" = "1" ] || [ "${1:-}" = "--force-report" ]; then
  send_telegram "✅ avaterra.pro: еженедельная сводка — сайт, БД, сервисы, диск (${usage}%), почта, SSL (${left_days} дн.), бэкапы: всё в порядке."
fi
echo "OK"
