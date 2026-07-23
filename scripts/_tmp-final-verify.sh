#!/usr/bin/env bash
set -euo pipefail
echo "=== health ==="
curl -sS https://avaterra.pro/api/health
echo
echo "=== service ==="
systemctl is-active aletheia.service
echo "=== commit ==="
cd /opt/ALETHEIA && git log -1 --oneline
echo "=== email log rudenko ==="
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT datetime(createdAt/1000,'unixepoch','localtime'), recipient, status, substr(ifnull(errorMessage,''),1,80) FROM EmailDeliveryLog WHERE recipient='rudenkoelena7667@gmail.com' ORDER BY createdAt DESC LIMIT 3;"
