#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
PHP=$(docker ps --format '{{.Names}}' | awk '/php-fpm-mailcow/{print;exit}')
RD=$(docker ps --format '{{.Names}}' | awk '/redis-mailcow/{print;exit}')
echo "=== redis keys info/yarik/support ==="
for e in info yarik support admin; do
  echo "-- $e --"
  docker exec "$RD" redis-cli KEYS "*${e}*" 2>/dev/null | head -10
done
echo ""
echo "=== mailbox() function snippet ==="
docker exec "$PHP" grep -n "function mailbox" /web/inc/functions.mailbox.inc.php 2>/dev/null | head -5
docker exec "$PHP" sed -n '1,120p' /web/inc/functions.mailbox.inc.php 2>/dev/null | head -40
echo ""
echo "=== HEX username info@ ==="
cd /opt/mailcow-dockerized
set -a; . ./mailcow.conf; set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -Nse \
  "SELECT username, HEX(username), LENGTH(username), CHAR_LENGTH(username) FROM mailbox WHERE username LIKE '%info%avaterra%';"
REMOTE
