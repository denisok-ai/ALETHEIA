#!/bin/bash
echo ========== 4b SystemSetting keys ==========
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT key FROM SystemSetting WHERE key GLOB "*cron*" OR key GLOB "*mailcow*" OR key GLOB "*provision*";"
echo lengths for cron_secret and mailcow_api_key if present:
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT key, length(value) AS len FROM SystemSetting WHERE key IN ("cron_secret","mailcow_api_key","mail_provisioning_mode");"