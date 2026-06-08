#!/usr/bin/env bash
# Восстановление node_modules и пересборка Next.js на прод-VPS (ошибка missing next/dist/compiled/cookie и т.п.).
# Запуск с вашего ПК (WSL), после chmod +x:
#   bash scripts/prod-repair-next-deps-remote.sh
# Нужен SSH-ключ к root (см. scripts/.deploy.env.example).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/scripts/.deploy.env"
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
KEY=""
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
REMOTE="${USER}@${HOST}"
echo "SSH $REMOTE with key $KEY"
ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$REMOTE" bash -s <<'REMOTE'
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd /opt/ALETHEIA
command -v npm >/dev/null || { echo "npm не найден в PATH; войдите интерактивно на сервер и выполните npm ci вручную." >&2; exit 1; }
npm ci
npm run build
systemctl restart aletheia.service
sleep 2
systemctl is-active aletheia.service
curl -sS -o /dev/null -w "health HTTP %{http_code}\n" http://127.0.0.1:3000/api/health || true
REMOTE
