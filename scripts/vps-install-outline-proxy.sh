#!/bin/bash
set -euo pipefail
mkdir -p /etc/aletheia /etc/sing-box
if [[ ! -f /etc/aletheia/outline-access.key ]]; then
  echo "missing /etc/aletheia/outline-access.key" >&2
  exit 1
fi
chmod 700 /etc/aletheia
chmod 600 /etc/aletheia/outline-access.key
GOST_BIN=""
for c in /usr/local/bin/gost-go /usr/bin/gost; do [[ -x "$c" ]] && GOST_BIN="$c" && break; done
if [[ -z "$GOST_BIN" ]]; then
  t=$(mktemp -d)
  curl -fsSL https://github.com/go-gost/gost/releases/download/v3.2.6/gost_3.2.6_linux_amd64.tar.gz | tar -xz -C "$t"
  install -m 755 "$t/gost" /usr/local/bin/gost-go
  GOST_BIN=/usr/local/bin/gost-go
  rm -rf "$t"
fi
if [[ ! -x /usr/local/bin/sing-box ]]; then
  curl -fsSL -o /tmp/sb.tgz https://github.com/SagerNet/sing-box/releases/download/v1.11.4/sing-box-1.11.4-linux-amd64.tar.gz
  tar -xzf /tmp/sb.tgz -C /tmp
  install -m755 /tmp/sing-box-1.11.4-linux-amd64/sing-box /usr/local/bin/sing-box
fi
python3 /tmp/outline_gen_singbox_config.py
/usr/local/bin/sing-box check -c /etc/sing-box/outline-telegram.json
cat > /etc/systemd/system/outline-ss-local.service <<UNIT
[Unit]
Description=Outline sing-box SOCKS for Telegram (aes-192-gcm)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/sing-box run -c /etc/sing-box/outline-telegram.json
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
cat > /etc/systemd/system/outline-telegram-proxy.service <<UNIT
[Unit]
Description=gost HTTP proxy for Telegram via Outline SOCKS
After=outline-ss-local.service
Requires=outline-ss-local.service

[Service]
Type=simple
ExecStart=$GOST_BIN -L http://127.0.0.1:18080 -F socks5://127.0.0.1:1080
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable outline-ss-local.service outline-telegram-proxy.service
systemctl restart outline-ss-local.service
sleep 2
systemctl restart outline-telegram-proxy.service
sleep 2
ENV=/opt/ALETHEIA/.env
touch "$ENV"
chmod 600 "$ENV"
for k in HTTPS_PROXY HTTP_PROXY; do
  if grep -q "^${k}=" "$ENV"; then
    sed -i "s|^${k}=.*|${k}=http://127.0.0.1:18080|" "$ENV"
  else
    echo "${k}=http://127.0.0.1:18080" >> "$ENV"
  fi
done
systemctl restart aletheia
sleep 4
systemctl is-active outline-ss-local outline-telegram-proxy aletheia
curl -sS -o /dev/null -w "proxy_telegram=%{http_code}\n" --connect-timeout 15 -x http://127.0.0.1:18080 https://api.telegram.org/
