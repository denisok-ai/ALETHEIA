#!/bin/bash
set -euo pipefail
python3 /tmp/outline_gen_singbox_config.py
pkill -f 'sing-box run' 2>/dev/null || true
pkill -f 'gost-go -L http://127.0.0.1:18080' 2>/dev/null || true
sleep 1
/usr/local/bin/sing-box run -c /etc/sing-box/outline-telegram.json > /tmp/sing.log 2>&1 &
sleep 2
/usr/local/bin/gost-go -L http://127.0.0.1:18080 -F socks5://127.0.0.1:1080 > /tmp/gost.log 2>&1 &
sleep 2
curl -sS -o /dev/null -w 'tg=%{http_code}\n' --connect-timeout 15 -x http://127.0.0.1:18080 https://api.telegram.org/
tail -8 /tmp/sing.log
