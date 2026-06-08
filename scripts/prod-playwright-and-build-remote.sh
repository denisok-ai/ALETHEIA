#!/usr/bin/env bash
# Одноразово на проде: добавить devDependency @playwright/test (нужен для next build из‑за playwright.config.ts) и пересобрать.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/.deploy.env"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
REMOTE="${USER}@${HOST}"
ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$REMOTE" \
  'export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
   cd /opt/ALETHEIA
   npm install -D "@playwright/test@^1.49.0"
   npm run build
   systemctl restart aletheia.service
   sleep 2
   systemctl is-active aletheia.service
   curl -sS http://127.0.0.1:3000/api/health | head -c 180
   echo'
