#!/usr/bin/env bash
# Деплой /about в меню Telegram: копирование sources, build на VPS, systemd, setMyCommands.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_USER:-root}@${DEPLOY_HOST:-95.181.224.70}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/ALETHEIA}"

echo "=== SSH test ==="
ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "hostname && echo OK"

echo "=== Copy telegram-bot sources + verify script ==="
scp -i "$KEY" -o BatchMode=yes \
  "$ROOT/lib/telegram-bot/commands.ts" \
  "$ROOT/lib/telegram-bot/router.ts" \
  "$ROOT/lib/telegram-bot/faq.ts" \
  "$ROOT/lib/telegram-bot/support-handlers.ts" \
  "${HOST}:${REMOTE_DIR}/lib/telegram-bot/"
scp -i "$KEY" -o BatchMode=yes \
  "$ROOT/scripts/verify-telegram-commands.ts" \
  "${HOST}:${REMOTE_DIR}/scripts/"

echo "=== Remote: webhook + verify (setMyCommands) ==="
ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "REMOTE_DIR='$REMOTE_DIR' bash -se" <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"
pm2 stop aletheia 2>/dev/null || true
echo "=== restart poll daemon (сброс кэша tsx-модулей) ==="
sudo systemctl restart aletheia-telegram-poll.service 2>/dev/null || true
sleep 2
echo "=== setup-telegram-webhook ==="
npx tsx scripts/setup-telegram-webhook.ts 2>&1
echo "=== getMyCommands verify ==="
npx tsx scripts/verify-telegram-commands.ts 2>&1
sleep 5
echo "=== verify after 5s (poll не перезаписал) ==="
npx tsx scripts/verify-telegram-commands.ts 2>&1
echo "=== systemctl restart aletheia ==="
sudo systemctl restart aletheia || true
sleep 5
sudo systemctl status aletheia --no-pager | head -8 || true
REMOTE

echo "=== DONE ==="
