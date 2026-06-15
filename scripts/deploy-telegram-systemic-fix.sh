#!/usr/bin/env bash
# Деплой Telegram-бота (long-polling): код, systemd, без webhook.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
[[ -f "$SCRIPT_DIR/.deploy.env" ]] && source "$SCRIPT_DIR/.deploy.env"
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_USER:-root}@${DEPLOY_HOST:-95.181.224.70}"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "→ Копирование файлов на прод..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" "mkdir -p /tmp/tg-fix"
TMP_FIX="$(mktemp -d)"
cp "$ROOT/app/api/portal/telegram/webhook/route.ts" "$TMP_FIX/webhook-route.ts"
cp "$ROOT/app/api/portal/admin/settings/telegram-webhook/route.ts" "$TMP_FIX/admin-telegram-webhook-route.ts"
scp -i "$KEY" -o StrictHostKeyChecking=no \
  "$TMP_FIX/webhook-route.ts" \
  "$TMP_FIX/admin-telegram-webhook-route.ts" \
  "$ROOT/lib/telegram-long-poll.ts" \
  "$ROOT/lib/telegram-bot/router.ts" \
  "$ROOT/lib/telegram-webhook-setup.ts" \
  "$ROOT/lib/telegram-webhook-env.ts" \
  "$ROOT/lib/telegram-poll-fallback.ts" \
  "$ROOT/lib/telegram-update-dedup.ts" \
  "$ROOT/lib/telegram-fetch.ts" \
  "$ROOT/lib/telegram.ts" \
  "$ROOT/lib/telegram-bot/commands.ts" \
  "$ROOT/lib/telegram-bot/settings-cache.ts" \
  "$ROOT/lib/telegram-bot/funnel.ts" \
  "$ROOT/lib/telegram-bot/faq.ts" \
  "$ROOT/lib/telegram-bot/types.ts" \
  "$ROOT/lib/telegram-bot/admin-handlers.ts" \
  "$ROOT/lib/telegram-bot/keyboards.ts" \
  "$ROOT/lib/telegram-bot/support-handlers.ts" \
  "$ROOT/scripts/nginx-aletheia.conf" \
  "$ROOT/scripts/telegram-webhook-health.sh" \
  "$ROOT/scripts/disable-pm2-aletheia.sh" \
  "$ROOT/scripts/prod-send-menu.ts" \
  "$ROOT/scripts/telegram-poll-worker.ts" \
  "$ROOT/scripts/telegram-poll-daemon.ts" \
  "$ROOT/scripts/telegram-delete-webhook.ts" \
  "$ROOT/scripts/setup-telegram-webhook.ts" \
  "$ROOT/scripts/verify-telegram-commands.ts" \
  "$ROOT/scripts/telegram-webhook-info.ts" \
  "$ROOT/scripts/sync-telegram-env-to-dotenv.ts" \
  "$ROOT/scripts/aletheia-telegram-poll.service" \
  "$HOST:/tmp/tg-fix/"

ssh -i "$KEY" -o StrictHostKeyChecking=no "$HOST" bash -s <<'REMOTE'
set -euo pipefail
mkdir -p /tmp/tg-fix
cd /opt/ALETHEIA
cp /tmp/tg-fix/webhook-route.ts app/api/portal/telegram/webhook/route.ts
cp /tmp/tg-fix/admin-telegram-webhook-route.ts app/api/portal/admin/settings/telegram-webhook/route.ts
for f in telegram-long-poll.ts telegram-webhook-setup.ts telegram-webhook-env.ts telegram-poll-fallback.ts \
  telegram-update-dedup.ts telegram-fetch.ts telegram.ts; do
  cp "/tmp/tg-fix/$f" "lib/$f"
done
for f in router.ts commands.ts settings-cache.ts funnel.ts faq.ts types.ts admin-handlers.ts keyboards.ts support-handlers.ts; do
  cp "/tmp/tg-fix/$f" "lib/telegram-bot/$f"
done
chmod +x /tmp/tg-fix/telegram-webhook-health.sh /tmp/tg-fix/disable-pm2-aletheia.sh
cp /tmp/tg-fix/telegram-webhook-health.sh scripts/
cp /tmp/tg-fix/disable-pm2-aletheia.sh scripts/
cp /tmp/tg-fix/prod-send-menu.ts scripts/
cp /tmp/tg-fix/telegram-poll-worker.ts scripts/
cp /tmp/tg-fix/telegram-poll-daemon.ts scripts/
cp /tmp/tg-fix/telegram-delete-webhook.ts scripts/
cp /tmp/tg-fix/setup-telegram-webhook.ts scripts/
cp /tmp/tg-fix/verify-telegram-commands.ts scripts/
cp /tmp/tg-fix/telegram-webhook-info.ts scripts/
cp /tmp/tg-fix/sync-telegram-env-to-dotenv.ts scripts/
cp /tmp/tg-fix/aletheia-telegram-poll.service scripts/
chmod +x scripts/telegram-webhook-health.sh scripts/disable-pm2-aletheia.sh

echo "=== sync TELEGRAM_* to .env ==="
npx tsx scripts/sync-telegram-env-to-dotenv.ts 2>&1
grep -q '^TELEGRAM_BOT_TOKEN=' .env

echo "=== nginx ==="
cp /tmp/tg-fix/nginx-aletheia.conf /etc/nginx/sites-available/aletheia
nginx -t && systemctl reload nginx

echo "=== build (optional; poll worker uses tsx, not .next) ==="
npm run build 2>&1 | tail -8 || echo "WARN: build failed — aletheia not restarted; poll worker still updated"

echo "=== disable PM2 aletheia (systemd only) ==="
bash scripts/disable-pm2-aletheia.sh || true

echo "=== restart aletheia ==="
systemctl restart aletheia
sleep 3
systemctl is-active aletheia outline-ss-local outline-telegram-proxy

echo "=== delete webhook + poll worker ==="
npx tsx scripts/telegram-delete-webhook.ts 2>&1
cp scripts/aletheia-telegram-poll.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable aletheia-telegram-poll.service
systemctl restart aletheia-telegram-poll.service
sleep 2
systemctl is-active aletheia-telegram-poll.service

echo "=== webhook info (expect empty url) ==="
npx tsx scripts/telegram-webhook-info.ts 2>&1

echo "=== commands (/about) ==="
npx tsx scripts/verify-telegram-commands.ts 2>&1

echo "=== outbound menu test ==="
npx tsx scripts/prod-send-menu.ts 337952743 2>&1 | tail -4

echo "=== cron health (poll mode, no setWebhook) ==="
CRON_LINE='*/5 * * * * root /opt/ALETHEIA/scripts/telegram-webhook-health.sh >> /var/log/telegram-webhook-health.log 2>&1'
echo "$CRON_LINE" > /etc/cron.d/aletheia-telegram
chmod 644 /etc/cron.d/aletheia-telegram
rm -f /etc/cron.d/aletheia-telegram-poll 2>/dev/null || true

echo "=== poll daemon log ==="
tail -8 /var/log/telegram-poll-daemon.log 2>/dev/null || true
REMOTE

echo "✓ Готово"
