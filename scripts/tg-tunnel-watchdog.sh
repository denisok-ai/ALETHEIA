#!/usr/bin/env bash
# Сторож туннеля Telegram на проде AVATERRA (tg-tunnel-watchdog.timer, раз в 2 минуты, от root).
#
# Цепочка: openconnect-telegram (ocserv NL5, SOCKS 127.0.0.1:1091) → gost 127.0.0.1:18080 → HTTPS_PROXY бота.
# Если цепочка падает, бот и алерты прода молча перестают доходить, поэтому тревога идёт ПИСЬМОМ
# через почту самого сервера (mailcow, SMTP-учётка сайта из /opt/ALETHEIA/.env), а не через Telegram.
#
# Что делает:
#   2 неудачи подряд  → перезапуск openconnect-telegram (+ gost, если не отвечает только он);
#   4 неудачи подряд  → переключение nodevonly.freemyip.com в /etc/hosts на следующий адрес из CANDIDATES
#                        (у NL5 два IP с одним ocserv и одним пином) и перезапуск туннеля;
#   ALERT_AFTER неудач → письмо на ALERT_TO, затем напоминание раз в 6 часов; при восстановлении — письмо «снова работает».
# Настройки: /etc/default/tg-tunnel-watchdog (ALERT_TO, CANDIDATES, ALERT_AFTER). Журнал: journalctl -t tg-tunnel-watchdog.
# Проверка без реального сбоя: DRY_RUN=1 FORCE_FAIL=1 tg-tunnel-watchdog (письмо не уходит, печатается).
set -uo pipefail
[ -f /etc/default/tg-tunnel-watchdog ] && . /etc/default/tg-tunnel-watchdog
ALERT_TO=${ALERT_TO:-}
CANDIDATES=${CANDIDATES:-"89.110.127.47 91.84.101.45"}
ALERT_AFTER=${ALERT_AFTER:-6}          # 6 × 2 мин ≈ 12 минут без Telegram
HOST=nodevonly.freemyip.com
PIN=${PIN:-$(grep -o 'pin-sha256:[^"]*' /usr/local/bin/openconnect-telegram.sh | head -1)}
STATE=/var/lib/tg-tunnel-watchdog; mkdir -p "$STATE"
log() {
  if [ -n "${DRY_RUN:-}" ]; then echo "$*"; logger -t tg-tunnel-watchdog "[DRY_RUN, ничего не менялось] $*"
  else logger -t tg-tunnel-watchdog "$*"; fi
}

probe() {  # $1 — прокси; успех, если api.telegram.org ответил 302/200
  local c; c=$(curl -s -o /dev/null -m 15 -w '%{http_code}' -x "$1" https://api.telegram.org/ 2>/dev/null)
  [ -z "${FORCE_FAIL:-}" ] && { [ "$c" = "302" ] || [ "$c" = "200" ]; }
}
current_ip() { awk -v h="$HOST" '$2==h {print $1; exit}' /etc/hosts; }
pin_of() {  # pin-sha256 сертификата на $1:443 (пусто — TLS не прошёл)
  local p; p=$(echo | timeout 12 openssl s_client -connect "$1:443" -servername "$HOST" 2>/dev/null \
      | openssl x509 -pubkey -noout 2>/dev/null | openssl pkey -pubin -outform der 2>/dev/null \
      | openssl dgst -sha256 -binary | openssl base64)
  [ -n "$p" ] && echo "pin-sha256:$p"
}

send_mail() {  # $1 — тема, $2 — текст
  if [ -n "${DRY_RUN:-}" ] || [ -z "$ALERT_TO" ]; then
    echo "[письмо → ${ALERT_TO:-нет ALERT_TO}] $1"; echo "$2"; return 0
  fi
  SUBJ="$1" BODY="$2" TO="$ALERT_TO" python3 - <<'EOF' || logger -t tg-tunnel-watchdog "письмо не отправлено"
import os, smtplib, ssl
from email.message import EmailMessage
env = {}
for line in open("/opt/ALETHEIA/.env", encoding="utf-8"):
    if "=" in line and not line.lstrip().startswith("#"):
        k, v = line.rstrip("\n").split("=", 1); env[k] = v.strip().strip('"').strip("'")
m = EmailMessage()
m["From"] = f"AVATERRA сторож <{env['MAIL_SMTP_USER']}>"
m["To"] = os.environ["TO"]; m["Subject"] = os.environ["SUBJ"]
m.set_content(os.environ["BODY"])
with smtplib.SMTP(env.get("MAIL_SMTP_HOST", "mail.avaterra.pro"), int(env.get("MAIL_SMTP_PORT", "587")), timeout=30) as s:
    s.starttls(context=ssl.create_default_context())
    s.login(env["MAIL_SMTP_USER"], env["MAIL_SMTP_PASSWORD"])
    s.send_message(m)
EOF
}

details() {
  echo "Сервер: AVATERRA 95.181.224.70 (avaterra.pro)"
  echo "Неудачных проверок подряд: $fails (раз в 2 минуты)"
  echo "Текущий адрес VPN: $HOST → $(current_ip)"
  for ip in $CANDIDATES; do
    p=$(pin_of "$ip")
    if [ -z "$p" ]; then echo "  $ip:443 — TLS не проходит (блокировка или сервер лёг)"
    elif [ "$p" != "$PIN" ]; then echo "  $ip:443 — TLS есть, но ПИН СМЕНИЛСЯ: $p (в туннеле $PIN)"
    else echo "  $ip:443 — TLS есть, пин совпадает"; fi
  done
  echo
  echo "openconnect-telegram: $(systemctl is-active openconnect-telegram), рестартов: $(systemctl show -p NRestarts --value openconnect-telegram)"
  echo "Последние строки журнала туннеля:"
  journalctl -u openconnect-telegram -n 8 --no-pager -q 2>/dev/null | cut -c1-200
  echo
  echo "Что делать: docs/Diary.md (19.11.2026) в репо AVATERRA. Смена пина — /usr/local/bin/openconnect-telegram.sh,"
  echo "реквизиты — /etc/openconnect-telegram.env, учётка avaterra-tg ведётся в проекте VPN (ocserv NL5)."
}

if [ "${1:-}" = "--test-mail" ]; then
  send_mail "[тест] AVATERRA: сторож туннеля Telegram" \
"Тестовое письмо сторожа туннеля Telegram на AVATERRA (95.181.224.70).
Если Telegram с прода пропадёт дольше ~$((ALERT_AFTER * 2)) минут, сюда придёт тревога, после восстановления — «снова работает».
Сторож сам перезапускает туннель и переключается между адресами NL5 ($CANDIDATES).
Сейчас: $HOST → $(current_ip). Настройки: /etc/default/tg-tunnel-watchdog, журнал: journalctl -t tg-tunnel-watchdog."
  exit $?
fi

fails=$(cat "$STATE/fails" 2>/dev/null || echo 0)
if probe socks5h://127.0.0.1:1091; then
  if ! probe http://127.0.0.1:18080; then
    log "SOCKS 1091 работает, gost 18080 — нет: перезапуск outline-telegram-proxy"
    [ -z "${DRY_RUN:-}" ] && systemctl restart outline-telegram-proxy
    exit 0
  fi
  if [ -f "$STATE/alerted" ]; then
    send_mail "✅ AVATERRA: Telegram с прода снова работает" \
"Туннель восстановлен $(date '+%d.%m.%Y %H:%M'). Адрес VPN: $HOST → $(current_ip).
Бот и алерты прода снова доходят."
    rm -f "$STATE/alerted" "$STATE/last_alert"
  fi
  [ "$fails" != 0 ] && log "Telegram снова доступен (после $fails неудач), VPN $(current_ip)"
  [ -z "${DRY_RUN:-}" ] && echo 0 > "$STATE/fails"
  exit 0
fi

fails=$((fails + 1)); [ -z "${DRY_RUN:-}" ] && echo "$fails" > "$STATE/fails"
log "Telegram недоступен через туннель ($fails подряд), VPN $(current_ip)"

if [ "$fails" -eq 2 ] && [ -z "${DRY_RUN:-}" ]; then
  log "перезапуск openconnect-telegram"; systemctl restart openconnect-telegram outline-telegram-proxy
fi
if [ "$fails" -ge 4 ] && [ $((fails % 4)) -eq 0 ]; then
  cur=$(current_ip)
  # следующий по кругу после текущего; если текущего нет в списке — первый
  next=$(echo "$CANDIDATES" | awk -v c="$cur" '{for(i=1;i<=NF;i++) if($i==c){print $(i%NF+1); exit} print $1}')
  if [ "$next" != "$cur" ] && [ "$(pin_of "$next")" = "$PIN" ]; then
    log "переключение $HOST: $cur → $next"
    if [ -z "${DRY_RUN:-}" ]; then
      cp -a /etc/hosts "$STATE/hosts.bak"
      sed -i "s/^[0-9.]\+\([[:space:]]\+$HOST\)\$/$next\1/" /etc/hosts
      systemctl restart openconnect-telegram outline-telegram-proxy
    fi
  else
    log "запасной адрес $next не подходит (TLS нет или другой пин) — остаёмся на $cur"
  fi
fi

if [ "$fails" -ge "$ALERT_AFTER" ]; then
  now=$(date +%s); last=$(cat "$STATE/last_alert" 2>/dev/null || echo 0)
  if [ ! -f "$STATE/alerted" ] || [ $((now - last)) -ge 21600 ]; then
    send_mail "⚠️ AVATERRA: Telegram с прода недоступен" "$(details)"
    [ -z "${DRY_RUN:-}" ] && { touch "$STATE/alerted"; echo "$now" > "$STATE/last_alert"; }
  fi
fi
exit 0
