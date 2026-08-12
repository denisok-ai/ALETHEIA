#!/usr/bin/env bash
# Восстановление Telegram-канала прода через Cloudflare WARP (WireGuard в sing-box).
#
# Контекст (2026-08-12): оба прежних канала умерли ~03.08 — VLESS-сервер
# 103.110.64.230 отвергает рукопожатие, домен outline nl.shadowvpn.ru удалён из
# DNS (кончилась VPN-подписка). С 03.08 не работали: студенческий Telegram-бот,
# алерты админам, автоимпорт постов канала в блог. Tor с VPS блокирован,
# WARP API с VPS блокирован — но доступен с домашней машины, поэтому:
#
#   ШАГ 1 (на этом компе): зарегистрировать WARP и получить профиль
#     cd <каталог с wgcf> && ./wgcf register --accept-tos && ./wgcf generate
#   ШАГ 2: bash scripts/restore-telegram-egress.sh <каталог с wgcf-файлами>
#
# Скрипт: собирает конфиг sing-box (SOCKS 127.0.0.1:1090 → WARP WireGuard),
# ставит unit warp-telegram.service, перенацеливает gost (18080) с мёртвого
# outline на WARP, переключает HTTPS_PROXY приложения на 18080, рестартит
# сервисы и проверяет цепочку до api.telegram.org.
#
# Откат: вернуть HTTPS_PROXY в /opt/ALETHEIA/.env (бэкап рядом), удалить
# drop-in gost и unit warp-telegram, рестарт сервисов.
set -euo pipefail

VPS=root@95.181.224.70
DIR="${1:-.}"
PROFILE="$DIR/wgcf-profile.conf"
ACCOUNT="$DIR/wgcf-account.toml"

[[ -f "$PROFILE" ]] || { echo "Нет $PROFILE — сначала ШАГ 1 (wgcf register + generate)"; exit 1; }
[[ -f "$ACCOUNT" ]] || { echo "Нет $ACCOUNT"; exit 1; }

PRIV=$(grep -m1 '^PrivateKey' "$PROFILE" | cut -d= -f2- | tr -d ' ')
PUB=$(grep -m1 '^PublicKey' "$PROFILE" | cut -d= -f2- | tr -d ' ')
ENDPOINT=$(grep -m1 '^Endpoint' "$PROFILE" | cut -d= -f2- | tr -d ' ')
EP_HOST="${ENDPOINT%:*}"
EP_PORT="${ENDPOINT##*:}"
ADDR4=$(grep -m1 '^Address' "$PROFILE" | cut -d= -f2- | tr -d ' ' | tr ',' '\n' | grep '\.' | head -1)
ADDR6=$(grep -m1 '^Address' "$PROFILE" | cut -d= -f2- | tr -d ' ' | tr ',' '\n' | grep ':' | head -1 || true)
# client_id пишут не все версии wgcf; для wgcf-аккаунтов reserved-байты не
# обязательны (профиль работает с обычным WireGuard) — тогда [0,0,0].
CLIENT_ID=$(grep -m1 'client_id' "$ACCOUNT" | cut -d"'" -f2 || true)
if [[ -n "$CLIENT_ID" ]]; then
  RESERVED=$(python3 -c "import base64;print(list(base64.b64decode('$CLIENT_ID')))")
else
  RESERVED="[0, 0, 0]"
fi

echo "Endpoint: $EP_HOST:$EP_PORT; addr4=$ADDR4; reserved=$RESERVED"
[[ -n "$PRIV" && -n "$ADDR4" && -n "$RESERVED" ]] || { echo "Не удалось разобрать профиль"; exit 1; }

ADDRESSES="\"$ADDR4\""
[[ -n "$ADDR6" ]] && ADDRESSES="$ADDRESSES, \"$ADDR6\""

ssh "$VPS" "PRIV='$PRIV' PUB='$PUB' EP_HOST='$EP_HOST' EP_PORT='$EP_PORT' ADDRESSES='$ADDRESSES' RESERVED='$RESERVED' bash -se" <<'REMOTE'
set -euo pipefail

echo "=== 1/5 Конфиг sing-box (SOCKS 1090 → WARP) ==="
cat > /etc/sing-box/warp-telegram.json <<EOF
{
  "log": { "level": "warn" },
  "inbounds": [
    { "type": "socks", "tag": "socks-in", "listen": "127.0.0.1", "listen_port": 1090 }
  ],
  "endpoints": [
    {
      "type": "wireguard",
      "tag": "warp",
      "address": [ $ADDRESSES ],
      "private_key": "$PRIV",
      "mtu": 1280,
      "peers": [
        {
          "address": "$EP_HOST",
          "port": $EP_PORT,
          "public_key": "$PUB",
          "allowed_ips": [ "0.0.0.0/0", "::/0" ],
          "reserved": $RESERVED
        }
      ]
    }
  ],
  "route": { "rules": [ { "inbound": [ "socks-in" ], "outbound": "warp" } ], "final": "warp" }
}
EOF
/usr/local/bin/sing-box check -c /etc/sing-box/warp-telegram.json

echo "=== 2/5 Сервис warp-telegram ==="
cat > /etc/systemd/system/warp-telegram.service <<'EOF'
[Unit]
Description=Cloudflare WARP egress for Telegram (sing-box WireGuard, SOCKS 127.0.0.1:1090)
After=network-online.target

[Service]
ExecStart=/usr/local/bin/sing-box run -c /etc/sing-box/warp-telegram.json
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now warp-telegram
sleep 4
curl -s -o /dev/null -w "SOCKS 1090 → api.telegram.org: %{http_code}\n" --max-time 20 -x socks5h://127.0.0.1:1090 https://api.telegram.org/

echo "=== 3/5 gost 18080 → WARP (drop-in, outline не трогаем) ==="
mkdir -p /etc/systemd/system/outline-telegram-proxy.service.d
cat > /etc/systemd/system/outline-telegram-proxy.service.d/warp-fallback.conf <<'EOF'
# 2026-08-12: outline-сервер умер (nl.shadowvpn.ru NXDOMAIN) — временно ходим
# через WARP (warp-telegram.service). Вернуть родной outline: удалить этот файл.
[Service]
ExecStart=
ExecStart=/usr/local/bin/gost-go -L http://127.0.0.1:18080 -F socks5://127.0.0.1:1090
EOF
systemctl daemon-reload
systemctl restart outline-telegram-proxy
sleep 2
curl -s -o /dev/null -w "HTTP 18080 → api.telegram.org: %{http_code}\n" --max-time 20 -x http://127.0.0.1:18080 https://api.telegram.org/

echo "=== 4/5 Переключение приложения (.env HTTPS_PROXY) ==="
cp -a /opt/ALETHEIA/.env "/opt/ALETHEIA/.env.bak-warp-$(date +%F-%H%M)"
sed -i 's|^HTTPS_PROXY=.*|HTTPS_PROXY=http://127.0.0.1:18080|' /opt/ALETHEIA/.env
grep '^HTTPS_PROXY=' /opt/ALETHEIA/.env
systemctl restart aletheia aletheia-telegram-poll aletheia-jobs

echo "=== 5/5 Сквозная проверка ==="
sleep 6
TOKEN=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' /opt/ALETHEIA/.env | cut -d= -f2-)
curl -s --max-time 20 -x http://127.0.0.1:18080 "https://api.telegram.org/bot${TOKEN}/getMe" | head -c 120; echo
bash /opt/ALETHEIA/scripts/cron-http-call.sh blog-telegram-sync && echo "blog-telegram-sync: OK" || echo "blog-telegram-sync: FAIL (лог /var/log/aletheia-cron-blog-telegram-sync.log)"
systemctl is-active aletheia aletheia-telegram-poll aletheia-jobs warp-telegram
echo "Готово."
REMOTE
