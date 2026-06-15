#!/usr/bin/env bash
# Отключить PM2 startup на проде — aletheia только через systemd (избежать EADDRINUSE на :3000).
set -euo pipefail
if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 не установлен — OK"
  exit 0
fi
pm2 delete aletheia 2>/dev/null || true
pm2 delete avaterra 2>/dev/null || true
pm2 save 2>/dev/null || true
if pm2 startup systemd -u root --hp /root 2>/dev/null | grep -q 'unstartup'; then
  pm2 unstartup systemd 2>/dev/null || true
fi
echo "PM2: приложения aletheia/avaterra удалены, startup отключён. Используйте: systemctl restart aletheia"
