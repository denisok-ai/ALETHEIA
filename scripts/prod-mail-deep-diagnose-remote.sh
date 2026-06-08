#!/usr/bin/env bash
# Расширенная диагностика SMTP/IMAP на проде (SSH с локальной машины).
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

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=25 "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
ENV=/opt/ALETHEIA/.env
ROOT=/opt/ALETHEIA

echo "=== MAIL_SMTP_* в .env (только факт наличия и длина пароля, без значения) ==="
if [[ -f "$ENV" ]]; then
  for k in MAIL_USE_OWN_SMTP EMAIL_TRANSPORT MAIL_SMTP_HOST MAIL_SMTP_PORT MAIL_SMTP_USER MAIL_SMTP_PASSWORD MAIL_IMAP_TLS_REJECT_UNAUTHORIZED; do
    line=$(grep -E "^${k}=" "$ENV" 2>/dev/null | head -1 || true)
    if [[ -z "$line" ]]; then
      echo "$k: ОТСУТСТВУЕТ"
    elif [[ "$k" == "MAIL_SMTP_PASSWORD" ]]; then
      val="${line#*=}"
      val="${val#\"}"
      val="${val%\"}"
      val="${val#\'}"
      val="${val%\'}"
      echo "$k: задано, длина ${#val} символов"
    else
      echo "$k: задано (${line%%=*}=…)"
    fi
  done
else
  echo "Нет файла $ENV"
fi

echo ""
echo "=== PM2 aletheia (последние строки с ошибками почты) ==="
if command -v pm2 >/dev/null 2>&1; then
  pm2 logs aletheia --lines 120 --nostream 2>&1 | grep -iE 'smtp|535|auth|mail|nodemailer|Error|ECONN' || echo "(совпадений нет в последних 120 строках)"
else
  echo "pm2 не найден"
fi

echo ""
echo "=== Тест TCP до submission (587) на mail.avaterra.pro ==="
timeout 4 bash -c 'echo QUIT | openssl s_client -connect mail.avaterra.pro:587 -starttls smtp 2>/dev/null' | head -20 || echo "(openssl недоступен или таймаут)"

REMOTE
