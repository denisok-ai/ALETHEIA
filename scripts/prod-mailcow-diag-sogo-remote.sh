#!/usr/bin/env bash
# Диагностика SOGo/403 на прод-Mailcow (запуск с машины с SSH-ключом).
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
echo "=== mailbox admin@avaterra.pro ==="
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT username, quota, active, attributes FROM mailbox WHERE username='admin@avaterra.pro'\G"
echo ""
echo "=== docker compose ps (mailcow) ==="
docker compose ps -a --format 'table {{.Name}}\t{{.Status}}' 2>/dev/null | head -40

NG=$(docker ps --format '{{.Names}}' | awk '/nginx-mailcow/{print;exit}')
SG=$(docker ps --format '{{.Names}}' | awk '/sogo-mailcow/{print;exit}')
echo ""
echo "=== last nginx-mailcow error log (tail 80) ==="
docker exec "$NG" tail -80 /var/log/nginx/error.log 2>/dev/null || docker exec "$NG" ls -la /var/log/nginx/

echo ""
echo "=== last sogo-mailcow logs (docker logs --tail 120) ==="
docker logs --tail 120 "$SG" 2>&1 || true

echo ""
echo "=== curl SOGo from nginx container (no cookie; expect redirect or 401/403) ==="
docker exec "$NG" curl -skSI --max-time 10 'http://127.0.0.1/SOGo/so/' 2>&1 | head -25

echo ""
echo "=== grep mailcow nginx SOGo snippets ==="
docker exec "$NG" sh -c 'grep -R "SOGo\|sogo" /etc/nginx/includes/*.conf 2>/dev/null | head -40' || true
REMOTE
