#!/usr/bin/env bash
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

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
MYSQL_C=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/ {print; exit}')
echo "mysql container=$MYSQL_C db=$DBNAME user=$DBUSER"
docker exec "$MYSQL_C" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SHOW COLUMNS FROM mailbox;"
echo
docker exec "$MYSQL_C" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT username,active,local_part,domain,JSON_EXTRACT(attributes,'$.force_pw_update') AS force_pw_update FROM mailbox WHERE username='admin@avaterra.pro';"
echo
echo "=== all mailboxes ==="
docker exec "$MYSQL_C" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT username,active,domain,authsource FROM mailbox ORDER BY username;"
REMOTE
