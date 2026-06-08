#!/usr/bin/env bash
# Пересборка Next.js на проде без npm ci (после правки tsconfig / выката файлов).
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
ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$REMOTE" bash -s <<'REMOTE'
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd /opt/ALETHEIA
command -v npm >/dev/null || { echo "npm не найден; установите Node или поправьте PATH на сервере." >&2; exit 1; }
npm run build
systemctl restart aletheia.service
sleep 3
systemctl is-active aletheia.service
curl -sS http://127.0.0.1:3000/api/health | head -c 220
echo
REMOTE
