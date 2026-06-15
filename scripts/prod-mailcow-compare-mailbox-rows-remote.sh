#!/usr/bin/env bash
# Полное сравнение строк mailbox (все колонки) для диагностики «есть в MySQL, нет в API».
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
[[ -f "$KEY" ]] || KEY="${HOME}/.ssh/avaterra_pro_root"
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
set -a; . ./mailcow.conf; set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
for u in admin@avaterra.pro info@avaterra.pro yarik@avaterra.pro support@avaterra.pro; do
  echo "========== $u =========="
  docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT * FROM mailbox WHERE username='$u'\G"
  echo ""
done
echo "=== DESCRIBE mailbox ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "DESCRIBE mailbox;"
REMOTE
