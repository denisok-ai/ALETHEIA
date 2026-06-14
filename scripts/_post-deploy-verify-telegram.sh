#!/usr/bin/env bash
set -euo pipefail
cd /home/denisok/projects/AVATERRA
source scripts/.deploy.env
H="${DEPLOY_HOST:-95.181.224.70}"
U="${DEPLOY_USER:-root}"
ssh -o StrictHostKeyChecking=accept-new -i "$DEPLOY_SSH_KEY" "${U}@${H}" bash <<'REMOTE'
set -e
cd /opt/ALETHEIA
echo "=== npx tsx scripts/telegram-poll-worker.ts ==="
npx tsx scripts/telegram-poll-worker.ts
echo
echo "=== npx tsx scripts/prod-send-menu.ts 337952743 ==="
npx tsx scripts/prod-send-menu.ts 337952743
echo
echo "=== getWebhookInfo ==="
set -a
source .env
set +a
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
echo
echo "=== tail -10 /var/log/telegram-poll-worker.log ==="
tail -10 /var/log/telegram-poll-worker.log
echo
echo "=== journalctl -u aletheia -n 20 | grep telegram ==="
journalctl -u aletheia -n 20 --no-pager | grep -i telegram || echo "(no matching lines)"
REMOTE
