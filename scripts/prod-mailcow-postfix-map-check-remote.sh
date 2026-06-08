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
POSTFIX=$(docker ps --format '{{.Names}}' | awk '/postfix-mailcow/ {print; exit}')
MYSQL=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/ {print; exit}')
cd /opt/mailcow-dockerized
set -a
. ./mailcow.conf
set +a
echo "=== postfix sender map files ==="
docker exec "$POSTFIX" sh -lc 'ls /opt/postfix/conf/sql/*sender* /opt/postfix/conf/sql/*acl* 2>/dev/null || true'
echo
echo "=== mysql_virtual_sender_acl.cf ==="
docker exec "$POSTFIX" sh -lc 'sed -n "1,160p" /opt/postfix/conf/sql/mysql_virtual_sender_acl.cf'
echo
echo "=== postmap queries ==="
docker exec "$POSTFIX" sh -lc 'for f in /opt/postfix/conf/sql/*sender* /opt/postfix/conf/sql/*acl*; do [ -f "$f" ] || continue; echo "-- $f"; postmap -q admin@avaterra.pro mysql:$f 2>&1 || true; done'
echo
echo "=== direct likely queries ==="
docker exec "$MYSQL" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT username,active,domain,kind,authsource,password<>'' AS has_password FROM mailbox WHERE username='admin@avaterra.pro';" 2>&1 || true
echo "--- alias ---"
docker exec "$MYSQL" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SHOW COLUMNS FROM alias; SELECT address,goto,active,sender_allowed FROM alias WHERE address IN ('admin@avaterra.pro','notifications@avaterra.pro');" 2>&1 || true
echo "--- sender_acl ---"
docker exec "$MYSQL" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SHOW COLUMNS FROM sender_acl; SELECT * FROM sender_acl WHERE logged_in_as='admin@avaterra.pro';" 2>&1 || true
REMOTE
