#!/usr/bin/env bash
# Одноразовая диагностика почты на прод-VPS (запуск с локальной машины: bash scripts/prod-mail-diagnose-remote.sh).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then KEY="$HOME/.ssh/avaterra_deploy_nopass"
else KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа: $KEY"; exit 1; }

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
DB=/opt/ALETHEIA/prisma/dev.db
ENV=/opt/ALETHEIA/.env

echo "=== hostname $(hostname) ==="
echo ""
echo "=== .env: наличие переменных MAIL_* / SMTP (без значений) ==="
if [[ -f "$ENV" ]]; then
  for k in MAIL_USE_OWN_SMTP EMAIL_TRANSPORT MAIL_IMAP_HOST MAIL_SMTP_HOST MAIL_SMTP_PORT MAIL_SMTP_USER MAIL_SMTP_PASSWORD MAIL_IMAP_TLS_REJECT_UNAUTHORIZED SMTP_HOST SMTP_USER SMTP_PASSWORD RESEND_API_KEY; do
    if grep -qE "^${k}=" "$ENV" 2>/dev/null; then
      echo "$k=***настроено***"
    else
      echo "$k=(нет строки)"
    fi
  done
else
  echo "НЕТ файла $ENV"
fi

echo ""
echo "=== SystemSetting (только не секретные ключи smtp/email_transport/resend_from) ==="
sqlite3 "$DB" <<'SQL'
.mode column
.headers on
SELECT key, value FROM SystemSetting 
WHERE key IN ('smtp_host','smtp_port','smtp_user','smtp_secure','email_transport','resend_from','resend_notify_email')
ORDER BY key;
SQL

echo ""
echo "=== InboundMailbox (без паролей) ==="
sqlite3 "$DB" <<'SQL'
.mode column
.headers on  
SELECT id, label, username, imapHost, imapPort, enabled,
       CASE WHEN length(passwordEnc) > 0 THEN '***encrypted***' ELSE '(empty)' END AS pwd_state,
       lastSyncStatus,
       substr(replace(ifnull(lastSyncError,''), char(10), ' '), 1, 120) AS err_preview
FROM InboundMailbox
ORDER BY label;
SQL

echo ""
echo "=== Последние 5 ошибок EmailDeliveryLog ==="
sqlite3 "$DB" "SELECT createdAt, recipient, substr(ifnull(errorMessage,''),1,120) FROM EmailDeliveryLog WHERE status='failed' ORDER BY createdAt DESC LIMIT 5;"

REMOTE
