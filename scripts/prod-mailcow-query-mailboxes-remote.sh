#!/usr/bin/env bash
# Сравнить attributes/quota/active у ящиков avaterra.pro
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
[[ -f "$KEY" ]] || KEY="${HOME}/.ssh/avaterra_pro_root"
[[ -f "$KEY" ]] || { echo "no ssh key"; exit 1; }

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
for u in info@avaterra.pro yarik@avaterra.pro support@avaterra.pro admin@avaterra.pro; do
  echo "=== $u ==="
  docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -Nse \
    "SELECT CONCAT('quota=', quota, ' active=', active, ' attrs=', attributes) FROM mailbox WHERE username='$u'" \
    || echo "(not found)"
  echo ""
done
REMOTE
