#!/usr/bin/env bash
# Загрузить скрипты смены паролей на прод и выполнить dry-run (без секретов).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
REMOTE="${DEPLOY_REMOTE_DIR:-/opt/ALETHEIA}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then KEY="$HOME/.ssh/avaterra_deploy_nopass"
else KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа: $KEY"; exit 1; }

scp -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$KEY" \
  "$ROOT/scripts/mailbox-password-set.ts" \
  "$ROOT/scripts/smtp-system-password-set.ts" \
  "${USER}@${HOST}:${REMOTE}/scripts/"

ssh -o BatchMode=yes -i "$KEY" "${USER}@${HOST}" bash -se <<REMOTE
set -euo pipefail
cd ${REMOTE}
echo "=== mailbox-password-set --dry-run ==="
npx --yes tsx scripts/mailbox-password-set.ts --email admin@avaterra.pro --dry-run
echo ""
echo "=== smtp-system-password-set --dry-run ==="
npx --yes tsx scripts/smtp-system-password-set.ts --dry-run
REMOTE
