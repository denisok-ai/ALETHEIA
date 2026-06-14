#!/bin/bash
set -euo pipefail
KEY=$(cat /etc/aletheia/outline-access.key | tr -d '\n')
pkill -f 'gost-go -L http://127.0.0.1:18080' 2>/dev/null || true
sleep 1
/usr/local/bin/gost-go -L http://127.0.0.1:18080 -F "$KEY" > /tmp/gost18080.log 2>&1 &
sleep 6
curl -sS -o /dev/null -w 'tg=%{http_code}\n' --connect-timeout 15 -x http://127.0.0.1:18080 https://api.telegram.org/
tail -10 /tmp/gost18080.log
