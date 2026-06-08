#!/usr/bin/env bash
# Короткие логи Mailcow SOGo/nginx + проверка полей mailbox (kind и т.д.)
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
echo "=== mailbox columns ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT username, domain, kind, active, quota FROM mailbox WHERE username='admin@avaterra.pro'\G"
echo ""
echo "=== sogo logs ==="
docker compose logs sogo-mailcow --tail 80 2>&1
echo ""
echo "=== nginx logs (last 40 lines, warning/error) ==="
docker compose logs nginx-mailcow --tail 120 2>&1 | grep -iE '403|forbidden|sogo|auth|error|denied' | tail -40 || docker compose logs nginx-mailcow --tail 40
REMOTE
