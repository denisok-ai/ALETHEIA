#!/bin/bash
set -euo pipefail
python3 /tmp/outline_gen_sslocal_config.py
pkill -f '/usr/local/bin/sslocal' 2>/dev/null || true
pkill -f 'gost-go -L http://127.0.0.1:18080' 2>/dev/null || true
sleep 1
/usr/local/bin/sslocal -c /etc/shadowsocks-libev/outline-telegram.json > /tmp/sslocal.log 2>&1 &
sleep 3
/usr/local/bin/gost-go -L http://127.0.0.1:18080 -F socks5://127.0.0.1:1080 > /tmp/gost18080.log 2>&1 &
sleep 3
curl -sS -o /dev/null -w 'tg=%{http_code}\n' --connect-timeout 15 -x http://127.0.0.1:18080 https://api.telegram.org/
tail -5 /tmp/sslocal.log
tail -3 /tmp/gost18080.log
