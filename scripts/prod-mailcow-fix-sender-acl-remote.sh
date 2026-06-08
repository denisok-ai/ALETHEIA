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
. ./mailcow.conf
set +a
MYSQL=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/ {print; exit}')
POSTFIX=$(docker ps --format '{{.Names}}' | awk '/postfix-mailcow/ {print; exit}')

docker exec -i "$MYSQL" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" <<'SQL'
DELETE FROM sender_acl WHERE logged_in_as='admin@avaterra.pro';
INSERT INTO sender_acl (logged_in_as, send_as, external) VALUES
  ('admin@avaterra.pro', 'admin@avaterra.pro', 0),
  ('admin@avaterra.pro', 'notifications@avaterra.pro', 0),
  ('admin@avaterra.pro', '@avaterra.pro', 0);
SELECT logged_in_as, send_as FROM sender_acl WHERE logged_in_as='admin@avaterra.pro';
SQL

docker exec "$POSTFIX" postmap -q admin@avaterra.pro mysql:/opt/postfix/conf/sql/mysql_virtual_sender_acl.cf || true
docker exec "$POSTFIX" postmap -q notifications@avaterra.pro mysql:/opt/postfix/conf/sql/mysql_virtual_sender_acl.cf || true
docker restart "$POSTFIX" >/dev/null
echo "sender_acl fixed and postfix restarted"
REMOTE
