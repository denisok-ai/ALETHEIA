#!/usr/bin/env bash
set -euo pipefail
SSH_KEY="${DEPLOY_SSH_KEY:-/home/denisok/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$ROOT/scripts/telegram-webhook-health.sh" "${USER}@${HOST}:/opt/ALETHEIA/scripts/"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${USER}@${HOST}" bash <<'REMOTE'
set -euo pipefail
chmod +x /opt/ALETHEIA/scripts/telegram-webhook-health.sh
CRON_FILE=/etc/cron.d/aletheia-telegram
CRON_LINE='*/5 * * * * root /opt/ALETHEIA/scripts/telegram-webhook-health.sh >> /var/log/telegram-webhook-health.log 2>&1'
if grep -qF telegram-webhook-health.sh "$CRON_FILE" 2>/dev/null; then
  echo "CRON_ALREADY=yes"
else
  printf '%s\n' "$CRON_LINE" > "$CRON_FILE"
  chmod 644 "$CRON_FILE"
  echo "CRON_INSTALLED=yes"
fi
cat "$CRON_FILE"
ls -la /opt/ALETHEIA/scripts/telegram-webhook-health.sh
echo "=== health ==="
bash /opt/ALETHEIA/scripts/telegram-webhook-health.sh || echo "health_failed"
REMOTE
