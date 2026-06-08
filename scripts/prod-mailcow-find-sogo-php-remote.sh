#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SCRIPT_DIR/.deploy.env" ]] && { set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; }
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
[[ -f "$KEY" ]] || KEY="${HOME}/.ssh/avaterra_pro_root"
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
docker compose exec -T php-fpm-mailcow pwd
docker compose exec -T php-fpm-mailcow ls /var/www/html/inc 2>/dev/null | head -15 || true
echo "--- grep sogo_user_profile ---"
docker compose exec -T php-fpm-mailcow grep -R "sogo_user_profile" /var/www/html/inc 2>/dev/null | head -25 || echo "(none)"
REMOTE
