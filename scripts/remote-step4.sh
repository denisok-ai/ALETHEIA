#!/bin/bash
set -euo pipefail
ENV=/opt/ALETHEIA/.env
echo ========== 4 inmail sync ==========
CRON=$(grep ^CRON_SECRET= $ENV | cut -d= -f2- | tr -d "\r")
if [ -z "$CRON" ]; then echo CRON_SECRET: NOT SET in .env; exit 0; fi
echo CRON_SECRET: present length $(echo -n $CRON | wc -c)
echo Trigger GET /api/cron/inmail-sync Bearer [REDACTED]
code=$(curl -s -o /tmp/inmail_sync.json -w %{http_code} -H "Authorization: Bearer $CRON" http://127.0.0.1:3000/api/cron/inmail-sync)
echo HTTP $code
head -c 4000 /tmp/inmail_sync.json; echo