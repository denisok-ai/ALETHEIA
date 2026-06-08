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
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SHOW TRIGGERS WHERE \`Table\` LIKE '%sogo%' OR \`Statement\` LIKE '%sogo%' ;" 2>/dev/null | head -40 || echo "(show triggers limited)"
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT COUNT(*) AS static_rows FROM _sogo_static_view;"
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT c_uid, mail, domain FROM _sogo_static_view LIMIT 10;"
REMOTE
