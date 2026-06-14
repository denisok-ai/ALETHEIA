#!/usr/bin/env bash
# Полная активация Telegram на VPS после деплоя.
set -euo pipefail
SSH_KEY="${DEPLOY_SSH_KEY:-/home/denisok/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/ALETHEIA}"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${USER}@${HOST}" bash <<REMOTE
set -euo pipefail
cd ${REMOTE_DIR}
echo "=== Restart aletheia ==="
systemctl restart aletheia
sleep 3
systemctl is-active aletheia
echo "=== Register webhook ==="
npx tsx scripts/prod-send-menu.ts 337952743 || echo "Webhook setup failed — проверьте токен и HTTPS_PROXY"
echo "=== Telegram API connectivity ==="
curl -sS -o /dev/null -w "http_code=%{http_code}\n" --connect-timeout 8 https://api.telegram.org || true
REMOTE
echo "Done. В админке: Chat ID админов → Тест оповещения."
