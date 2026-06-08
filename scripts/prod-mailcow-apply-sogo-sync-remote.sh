#!/usr/bin/env bash
# Пересобрать Mailcow _sogo_static_view штатной функцией update_sogo_static_view().
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_LOCAL="$SCRIPT_DIR/mailcow-cli-update-sogo-static-view.php"
[[ -f "$PHP_LOCAL" ]] || { echo "missing $PHP_LOCAL"; exit 1; }
[[ -f "$SCRIPT_DIR/.deploy.env" ]] && { set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; }
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
[[ -f "$KEY" ]] || KEY="${HOME}/.ssh/avaterra_pro_root"

echo "=== php update_sogo_static_view (stdin) ==="
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" \
  'cd /opt/mailcow-dockerized && docker compose exec -T php-fpm-mailcow php -d display_errors=1 -d error_reporting=E_ALL' \
  < "$PHP_LOCAL"

echo ""
echo "=== verify _sogo_static_view ==="
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT COUNT(*) AS rows_static FROM _sogo_static_view;"
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e "SELECT c_uid, mail, domain FROM _sogo_static_view LIMIT 10;"
REMOTE

echo ""
echo "Перезапуск SOGo..."
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" \
  'cd /opt/mailcow-dockerized && docker compose restart sogo-mailcow >/dev/null && echo OK'
