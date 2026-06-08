#!/usr/bin/env bash
# Запускает scripts/setup-probuzhdenie-course.ts на продуктивном VPS
# (создаёт очный курс «Пробуждение» и услуги в витрине). Идемпотентно.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi

HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
  KEY="$HOME/.ssh/avaterra_deploy_nopass"
else
  KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа: $KEY" >&2; exit 1; }

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=25 "${USER}@${HOST}" bash <<'REMOTE'
set -euo pipefail
cd /opt/ALETHEIA
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
command -v npx >/dev/null || { echo "npx не найден на VPS" >&2; exit 1; }
npx -y tsx scripts/setup-probuzhdenie-course.ts
REMOTE
