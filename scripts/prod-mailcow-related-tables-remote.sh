#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
set -a; . ./mailcow.conf; set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
echo "=== Tables with mailbox username column ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -Nse \
  "SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DBNAME' AND COLUMN_NAME='username' ORDER BY TABLE_NAME;"
echo ""
for tbl in user_acl app_password relayed rcpt_maps quarantine quarantine_notification filterconf sogo_cache_folder sogo_admin sogo_user_profile; do
  echo "=== $tbl info@ vs admin@ ==="
  docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
    "SELECT * FROM $tbl WHERE username IN ('info@avaterra.pro','admin@avaterra.pro') LIMIT 5;" 2>/dev/null \
    || echo "(table missing or no username col)"
done
echo ""
echo "=== mailbox count per domain ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT domain, COUNT(*) c FROM mailbox WHERE domain='avaterra.pro' GROUP BY domain;"
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT domain, mailboxes FROM domain WHERE domain='avaterra.pro';"
REMOTE
