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
DOVECOT=$(docker ps --format '{{.Names}}' | awk '/dovecot-mailcow/ {print; exit}')

docker exec -i "$MYSQL" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" <<'SQL'
INSERT INTO alias (address, goto, domain, sogo_visible, internal, sender_allowed, active)
VALUES ('admin@avaterra.pro', 'admin@avaterra.pro', 'avaterra.pro', 1, 0, 1, 1)
ON DUPLICATE KEY UPDATE goto='admin@avaterra.pro', active=1, sender_allowed=1;

INSERT INTO alias (address, goto, domain, sogo_visible, internal, sender_allowed, active)
VALUES ('notifications@avaterra.pro', 'admin@avaterra.pro', 'avaterra.pro', 1, 0, 1, 1)
ON DUPLICATE KEY UPDATE goto='admin@avaterra.pro', active=1, sender_allowed=1;

SELECT address,goto,active,sender_allowed FROM alias WHERE address IN ('admin@avaterra.pro','notifications@avaterra.pro');
SQL

docker restart "$POSTFIX" "$DOVECOT" >/dev/null
echo "aliases fixed; postfix/dovecot restarted"
REMOTE
