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
echo "=== containers ==="
docker ps --format '{{.Names}}' | awk '/mailcow|mysql|dovecot|postfix/ {print}'
echo
echo "=== mailcow dirs ==="
for d in /opt/mailcow-dockerized /opt/mailcow /root/mailcow-dockerized; do
  if [[ -d "$d" ]]; then echo "$d"; fi
done
echo
echo "=== mysql env keys ==="
docker inspect mysql-mailcow --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | awk -F= '/MYSQL_|DB/ {print $1"=***"}' || true
echo
echo "=== mailcow.conf db-ish keys (without values) ==="
for f in /opt/mailcow-dockerized/mailcow.conf /opt/mailcow/mailcow.conf /root/mailcow-dockerized/mailcow.conf; do
  if [[ -f "$f" ]]; then
    echo "file=$f"
    awk -F= '/DB|MYSQL/ {print $1"=***"}' "$f"
  fi
done
echo
echo "=== mailbox table columns (if mysql access works via env) ==="
docker exec mysql-mailcow sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -e "SHOW COLUMNS FROM mailbox;"' 2>/dev/null || true
REMOTE
