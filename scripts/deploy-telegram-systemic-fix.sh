#!/usr/bin/env bash
# Деплой системных фиксов Telegram-бота на прод: код, nginx, webhook, мониторинг, PM2.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
[[ -f "$SCRIPT_DIR/.deploy.env" ]] && source "$SCRIPT_DIR/.deploy.env"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_USER:-root}@${DEPLOY_HOST:-95.181.224.70}"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "→ Копирование файлов на прод..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" "mkdir -p /tmp/tg-fix"
scp -i "$KEY" -o StrictHostKeyChecking=no \
  "$ROOT/app/api/portal/telegram/webhook/route.ts" \
  "$ROOT/lib/telegram-bot/router.ts" \
  "$ROOT/lib/telegram-webhook-setup.ts" \
  "$ROOT/lib/telegram-webhook-env.ts" \
  "$ROOT/instrumentation.ts" \
  "$ROOT/scripts/nginx-aletheia.conf" \
  "$ROOT/scripts/telegram-webhook-health.sh" \
  "$ROOT/scripts/disable-pm2-aletheia.sh" \
  "$ROOT/scripts/prod-send-menu.ts" \
  "$ROOT/scripts/telegram-webhook-latency-prod.ts" \
  "$ROOT/scripts/telegram-poll-worker.ts" \
  "$ROOT/scripts/telegram-poll-worker.sh" \
  "$ROOT/scripts/telegram-webhook-reset-soft.ts" \
  "$ROOT/lib/telegram-poll-fallback.ts" \
  "$ROOT/scripts/sync-telegram-env-to-dotenv.ts" \
  "$ROOT/lib/telegram-update-dedup.ts" \
  "$ROOT/lib/telegram-bot/settings-cache.ts" \
  "$ROOT/lib/telegram-fetch.ts" \
  "$ROOT/lib/telegram.ts" \
  "$ROOT/lib/telegram-bot/support-handlers.ts" \
  "$ROOT/scripts/telegram-poll-daemon.ts" \
  "$ROOT/scripts/aletheia-telegram-poll.service" \
  "$HOST:/tmp/tg-fix/"

ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" bash -s <<'REMOTE'
set -euo pipefail
mkdir -p /tmp/tg-fix
cd /opt/ALETHEIA
cp /tmp/tg-fix/route.ts app/api/portal/telegram/webhook/route.ts
cp /tmp/tg-fix/router.ts lib/telegram-bot/router.ts
cp /tmp/tg-fix/telegram-webhook-setup.ts lib/telegram-webhook-setup.ts
cp /tmp/tg-fix/telegram-webhook-env.ts lib/telegram-webhook-env.ts
cp /tmp/tg-fix/instrumentation.ts instrumentation.ts
chmod +x /tmp/tg-fix/telegram-webhook-health.sh /tmp/tg-fix/disable-pm2-aletheia.sh
cp /tmp/tg-fix/telegram-webhook-health.sh scripts/
cp /tmp/tg-fix/disable-pm2-aletheia.sh scripts/
cp /tmp/tg-fix/prod-send-menu.ts scripts/
cp /tmp/tg-fix/telegram-webhook-latency-prod.ts scripts/
cp /tmp/tg-fix/telegram-poll-worker.ts scripts/
cp /tmp/tg-fix/telegram-poll-worker.sh scripts/
cp /tmp/tg-fix/telegram-webhook-reset-soft.ts scripts/
cp /tmp/tg-fix/telegram-poll-fallback.ts lib/
cp /tmp/tg-fix/telegram-update-dedup.ts lib/
cp /tmp/tg-fix/settings-cache.ts lib/telegram-bot/
cp /tmp/tg-fix/telegram-fetch.ts lib/
cp /tmp/tg-fix/telegram.ts lib/
cp /tmp/tg-fix/support-handlers.ts lib/telegram-bot/
cp /tmp/tg-fix/telegram-poll-daemon.ts scripts/
cp /tmp/tg-fix/aletheia-telegram-poll.service scripts/
cp /tmp/tg-fix/sync-telegram-env-to-dotenv.ts scripts/
chmod +x scripts/telegram-webhook-health.sh scripts/disable-pm2-aletheia.sh scripts/telegram-poll-worker.sh

echo "=== sync TELEGRAM_* to .env ==="
npx tsx scripts/sync-telegram-env-to-dotenv.ts 2>&1
grep -q '^TELEGRAM_BOT_TOKEN=' .env && grep -q '^TELEGRAM_WEBHOOK_SECRET=' .env

echo "=== nginx webhook location ==="
cp /tmp/tg-fix/nginx-aletheia.conf /etc/nginx/sites-available/aletheia
nginx -t && systemctl reload nginx

echo "=== disable PM2 aletheia ==="
bash scripts/disable-pm2-aletheia.sh || true

echo "=== build ==="
systemctl stop aletheia || true
rm -rf .next
npm run build 2>&1 | tail -8
systemctl start aletheia
sleep 3
systemctl restart aletheia
sleep 2
systemctl is-active aletheia outline-ss-local outline-telegram-proxy

echo "=== webhook reset + menu test ==="
npx tsx scripts/prod-send-menu.ts 337952743 2>&1 | tail -6

echo "=== webhook info ==="
npx tsx scripts/telegram-webhook-info.ts 2>&1

echo "=== webhook latency ==="
npx tsx scripts/telegram-webhook-latency-prod.ts 2>&1 || echo "WARN: webhook latency check failed (non-fatal)"

echo "=== cron health (install if missing) ==="
CRON_LINE='*/5 * * * * root /opt/ALETHEIA/scripts/telegram-webhook-health.sh >> /var/log/telegram-webhook-health.log 2>&1'
if ! grep -qF 'telegram-webhook-health.sh' /etc/cron.d/aletheia-telegram 2>/dev/null; then
  echo "$CRON_LINE" > /etc/cron.d/aletheia-telegram
  chmod 644 /etc/cron.d/aletheia-telegram
fi
echo "cron: /etc/cron.d/aletheia-telegram"

echo "=== telegram poll daemon (systemd, replaces 30s cron) ==="
cp scripts/aletheia-telegram-poll.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable aletheia-telegram-poll.service
systemctl restart aletheia-telegram-poll.service
systemctl is-active aletheia-telegram-poll.service
# Отключаем старый cron poll (30s) — дублировал webhook
rm -f /etc/cron.d/aletheia-telegram-poll 2>/dev/null || true
touch /var/log/telegram-poll-daemon.log
echo "systemd: aletheia-telegram-poll.service (2s unhealthy / 10s healthy)"

echo "=== poll worker one-shot (legacy) ==="
bash scripts/telegram-poll-worker.sh 2>&1 | tail -5 || true
tail -5 /var/log/telegram-poll-daemon.log 2>/dev/null || true
REMOTE

echo "✓ Готово"
