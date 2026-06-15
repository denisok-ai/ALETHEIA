#!/bin/bash
echo ========== 4b SystemSetting mail/cron ==========
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT key, length(value) AS len FROM SystemSetting WHERE key LIKE '%cron%' OR key LIKE '%mailcow%' OR key LIKE '%provision%';"
echo ========== 4c trigger inmail-sync if cron_secret in DB ==========
CRON=$(sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT value FROM SystemSetting WHERE key='cron_secret' LIMIT 1;")
if [ -z "$CRON" ]; then echo cron_secret not in SystemSetting; exit 0; fi
echo CRON_SECRET from DB length $(echo -n $CRON | wc -c)
echo curl /api/cron/inmail-sync Bearer [REDACTED]
code=$(curl -s -o /tmp/inmail_sync.json -w %{http_code} -H "Authorization: Bearer $CRON" http://127.0.0.1:3000/api/cron/inmail-sync)
echo HTTP $code
head -c 4000 /tmp/inmail_sync.json; echo
echo ========== 5 after sync ==========
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT im.username, im.lastSyncStatus, im.lastSyncError FROM InboundMailbox im WHERE im.username IN ('info@avaterra.pro','yarik@avaterra.pro');"