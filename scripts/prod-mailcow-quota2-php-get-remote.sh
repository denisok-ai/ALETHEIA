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
echo "=== quota2 ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT * FROM quota2 WHERE username LIKE '%@avaterra.pro';"
echo ""
echo "=== tags_mailbox ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT * FROM tags_mailbox WHERE username LIKE '%@avaterra.pro';" 2>/dev/null || echo "(empty/missing)"
echo ""
echo "=== grouped_sender_acl ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT * FROM grouped_sender_acl WHERE username LIKE '%@avaterra.pro';" 2>/dev/null || true
echo ""
echo "=== PHP mailbox get via CLI ==="
PHP=$(docker ps --format '{{.Names}}' | awk '/php-fpm-mailcow/{print;exit}')
docker exec "$PHP" php -r '
require_once "/web/inc/vars.inc.php";
require_once "/web/inc/functions.inc.php";
require_once "/web/inc/functions.mailbox.inc.php";
require_once "/web/inc/functions.docker.inc.php";
$dsn = $database_type . ":unix_socket=" . $database_sock . ";dbname=" . $database_name;
$pdo = new PDO($dsn, $database_user, $database_pass, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$GLOBALS["pdo"] = $pdo;
foreach (["info@avaterra.pro","admin@avaterra.pro"] as $u) {
  $r = mailbox("get", "mailbox", $u);
  echo $u . " => " . json_encode($r, JSON_UNESCAPED_UNICODE) . "\n";
}
' 2>&1 | head -40
REMOTE
