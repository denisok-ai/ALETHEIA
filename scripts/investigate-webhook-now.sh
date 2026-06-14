#!/usr/bin/env bash
# One-off prod diagnostics for Telegram bot
set -euo pipefail
SSH_KEY="${DEPLOY_SSH_KEY:-/home/denisok/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
source scripts/.deploy.env

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 "${USER}@${HOST}" bash <<'REMOTE'
echo "=== aletheia service ==="
systemctl is-active aletheia || true
echo "=== TELEGRAM/PROXY in .env (masked) ==="
grep -E '^(TELEGRAM|HTTPS_PROXY|HTTP_PROXY)' /opt/ALETHEIA/.env 2>/dev/null | sed 's/=.*/=***/' || echo "(none)"
echo "=== telegram keys in DB ==="
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT key, length(value) FROM SystemSetting WHERE key LIKE 'telegram%' OR key='site_url';" 2>/dev/null || echo "sqlite fail"
echo "=== api.telegram.org ==="
curl -sS -o /dev/null -w "http_code=%{http_code} time=%{time_total}s\n" --connect-timeout 8 https://api.telegram.org || echo "curl failed"
echo "=== avaterra-bot ==="
echo === getWebhookInfo ===
cd /opt/ALETHEIA
npx tsx scripts/telegram-webhook-info.ts
echo === journal 22:50 ===
echo === nginx webhook ===
echo === outline services ===
systemctl is-active outline-ss-local outline-telegram-proxy aletheia
npx tsx scripts/telegram-webhook-latency-prod.ts
cat /etc/cron.d/aletheia-telegram
systemctl is-active avaterra-bot 2>/dev/null || echo "not installed"
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -i bot || echo "no bot containers"
REMOTE
