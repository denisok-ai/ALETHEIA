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
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
echo "=== tables matching sogo (structure hint) ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SHOW TABLES LIKE '%sogo%';"
echo ""
echo "=== sample sogo_user_profile if exists ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT * FROM sogo_user_profile WHERE c_uid LIKE '%admin%' OR c_uid LIKE '%avaterra%' LIMIT 5;" 2>/dev/null || echo "(no sogo_user_profile or error)"
echo ""
echo "=== helper-scripts list (sync sogo) ==="
ls -la helper-scripts/ 2>/dev/null | grep -i sogo || ls helper-scripts/ | head -25
REMOTE
