#!/usr/bin/env bash
# На VPS Mailcow: починить ящик admin@avaterra.pro после ручного INSERT:
# - mailbox.attributes был `{}` → протоколы и SOGo в UI как «выключены», 401 в SOGo
# - quota мог быть ошибочно ~3072 байт вместо defquota домена в MiB
#
# Запуск с машины с SSH-ключом (как другие prod-remote скрипты):
#   bash scripts/prod-mailcow-fix-admin-mailbox-remote.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
[[ -f "$KEY" ]] || KEY="${HOME}/.ssh/avaterra_pro_root"
[[ -f "$KEY" ]] || { echo "no ssh key"; exit 1; }
MAILBOX="${MAILBOX_USER:-admin@avaterra.pro}"
DOMAIN="${MAIL_DOMAIN:-avaterra.pro}"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER}@${HOST}" bash -se <<REMOTE
set -euo pipefail
cd /opt/mailcow-dockerized
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
M=\$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')
DEF=\$(docker exec "\$M" mysql -u"\$DBUSER" -p"\$DBPASS" "\$DBNAME" -Nse \\
  "SELECT defquota FROM domain WHERE domain='${DOMAIN}' LIMIT 1")
[[ -n "\$DEF" ]] || { echo "domain ${DOMAIN} not found"; exit 1; }
# quota в таблице mailbox — байты; defquota домена — MiB (как в Mailcow UI)
QUOTA_B=\$((DEF * 1048576))
echo "defquota MiB=\$DEF -> mailbox.quota bytes=\$QUOTA_B"

docker exec "\$M" mysql -u"\$DBUSER" -p"\$DBPASS" "\$DBNAME" -e "
UPDATE mailbox
SET quota = \${QUOTA_B},
    attributes = JSON_OBJECT(
      'force_pw_update', '0',
      'force_tfa', '0',
      'tls_enforce_in', '0',
      'tls_enforce_out', '0',
      'sogo_access', '1',
      'imap_access', '1',
      'pop3_access', '1',
      'smtp_access', '1',
      'sieve_access', '1',
      'eas_access', '1',
      'dav_access', '1',
      'relayhost', '0',
      'passwd_update', UNIX_TIMESTAMP(NOW()),
      'mailbox_format', 'maildir:',
      'quarantine_notification', 'hourly',
      'quarantine_category', 'reject',
      'attribute_hash', ''
    )
WHERE username='${MAILBOX}';

SELECT username, quota, attributes FROM mailbox WHERE username='${MAILBOX}'\\G
"

echo ""
echo "Перезапуск SOGo / php-fpm..."
docker compose restart sogo-mailcow php-fpm-mailcow >/dev/null
echo "OK"
REMOTE
