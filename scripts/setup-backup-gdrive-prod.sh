#!/bin/bash
# Установка бэкапа в Google Drive на проде (запускать на сервере из /opt/ALETHEIA).
# Предварительно: rclone remote "gdrive" настроен (/root/.config/rclone/rclone.conf),
# passphrase в /root/.backup-passphrase (chmod 600).
set -euo pipefail

install -m 750 scripts/backup-gdrive-prod.sh /usr/local/bin/aletheia-backup-gdrive.sh

cat > /etc/cron.d/aletheia-backup-gdrive <<'EOF'
# Ежедневный бэкап БД и настроек в Google Drive (03:30 по серверному времени, MSK)
30 3 * * * root /usr/local/bin/aletheia-backup-gdrive.sh >> /var/log/aletheia-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/aletheia-backup-gdrive

echo "=== Пробный запуск ==="
/usr/local/bin/aletheia-backup-gdrive.sh
echo "=== В Google Drive ==="
rclone ls gdrive:avaterra-backups/daily | tail -3
