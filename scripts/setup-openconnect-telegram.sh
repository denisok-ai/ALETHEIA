#!/usr/bin/env bash
# Постоянный Telegram-egress через OpenConnect/AnyConnect VPN (userspace + ocproxy).
#
# Почему ocproxy, а не обычный tun: openconnect в режиме --script-tun работает
# полностью в user-space и НЕ трогает таблицу маршрутов сервера — почта
# (Mailcow), сайт и всё остальное продолжают ходить напрямую. Через VPN уходит
# ТОЛЬКО то, что идёт в SOCKS ocproxy (127.0.0.1:1091), а туда мы направляем
# лишь Telegram (gost 18080 → ocproxy, приложение → HTTPS_PROXY=18080).
#
# Заменяет временный мост через домашний комп (инцидент 03–12.08.2026).
# Реквизиты VPN — в /etc/openconnect-telegram.env (root-only), пин сертификата
# вычисляется автоматически. Запуск на сервере: bash setup-openconnect-telegram.sh
set -euo pipefail

ENV_FILE=/etc/openconnect-telegram.env
[[ -f "$ENV_FILE" ]] || { echo "Нет $ENV_FILE с реквизитами VPN"; exit 1; }
set -a; . "$ENV_FILE"; set +a
SERVER_HOST="${OC_SERVER%%:*}"
SERVER_IP="${OC_SERVER_FALLBACK%%:*}"

echo "=== 1/6 DNS: домен VPN резолвится через фиксированный IP ==="
# Сервер не резолвит freemyip.com (фильтр DNS-провайдера) — фиксируем в hosts.
if ! getent hosts "$SERVER_HOST" >/dev/null; then
  printf '%s %s\n' "$SERVER_IP" "$SERVER_HOST" >> /etc/hosts
fi
getent hosts "$SERVER_HOST"

echo "=== 2/6 Пин сертификата сервера VPN ==="
PIN="pin-sha256:$(echo | openssl s_client -connect "$SERVER_IP:443" -servername "$SERVER_HOST" 2>/dev/null \
  | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl base64)"
echo "$PIN"

echo "=== 3/6 Скрипт запуска openconnect+ocproxy ==="
cat > /usr/local/bin/openconnect-telegram.sh <<EOF
#!/usr/bin/env bash
set -euo pipefail
set -a; . $ENV_FILE; set +a
exec sh -c 'echo "\$OC_PASS" | exec openconnect \\
  --protocol=anyconnect \\
  --user="\$OC_USER" --passwd-on-stdin \\
  --servercert="$PIN" \\
  --script-tun --script "ocproxy -D 1091 -k 30" \\
  ${SERVER_HOST}:443'
EOF
chmod 700 /usr/local/bin/openconnect-telegram.sh

echo "=== 4/6 systemd-сервис openconnect-telegram ==="
cat > /etc/systemd/system/openconnect-telegram.service <<'EOF'
[Unit]
Description=OpenConnect VPN egress for Telegram (userspace ocproxy SOCKS 127.0.0.1:1091)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openconnect-telegram.sh
Restart=always
RestartSec=10
# ocproxy держит SOCKS на 1091, пока живёт туннель.

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now openconnect-telegram
echo "жду подъёма туннеля..."
sleep 20
curl -s -o /dev/null -w "SOCKS 1091 -> api.telegram.org: %{http_code}\n" --max-time 15 -x socks5h://127.0.0.1:1091 https://api.telegram.org/

echo "=== 5/6 gost 18080 -> ocproxy (drop-in) ==="
mkdir -p /etc/systemd/system/outline-telegram-proxy.service.d
cat > /etc/systemd/system/outline-telegram-proxy.service.d/warp-fallback.conf <<'EOF'
# 2026-08-12: egress через OpenConnect VPN (openconnect-telegram.service, SOCKS
# 1091). Родной outline nl.shadowvpn.ru мёртв. Вернуть штатный outline — удалить
# этот файл и восстановить рабочий outline-сервер.
[Service]
ExecStart=
ExecStart=/usr/local/bin/gost-go -L http://127.0.0.1:18080 -F socks5://127.0.0.1:1091
EOF
systemctl daemon-reload
systemctl restart outline-telegram-proxy
sleep 2
curl -s -o /dev/null -w "HTTP 18080 -> api.telegram.org: %{http_code}\n" --max-time 15 -x http://127.0.0.1:18080 https://api.telegram.org/

echo "=== 6/6 Переключение приложения на 18080 и проверка ==="
cp -a /opt/ALETHEIA/.env "/opt/ALETHEIA/.env.bak-oc-$(date +%F-%H%M)"
sed -i 's|^HTTPS_PROXY=.*|HTTPS_PROXY=http://127.0.0.1:18080|' /opt/ALETHEIA/.env
grep '^HTTPS_PROXY=' /opt/ALETHEIA/.env
systemctl restart aletheia aletheia-telegram-poll aletheia-jobs
sleep 6
TOKEN=$(grep -m1 '^TELEGRAM_BOT_TOKEN=' /opt/ALETHEIA/.env | cut -d= -f2-)
echo -n "getMe: "; curl -s --max-time 20 -x http://127.0.0.1:18080 "https://api.telegram.org/bot${TOKEN}/getMe" | head -c 90; echo
bash /opt/ALETHEIA/scripts/cron-http-call.sh blog-telegram-sync && echo "blog-telegram-sync: OK"
systemctl is-active openconnect-telegram outline-telegram-proxy aletheia
echo "Готово. Домашний мост (tg-egress) больше не нужен — можно остановить."
