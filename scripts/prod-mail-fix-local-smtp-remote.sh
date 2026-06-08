#!/usr/bin/env bash
# Продукт: поправить SMTP под локальный Mailcow без git.
# Запуск с ПК (WSL): MAIL_SMTP_USER=admin@avaterra.pro bash scripts/prod-mail-fix-local-smtp-remote.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USERISH="${DEPLOY_USER:-root}"
MU="${MAIL_SMTP_USER:-admin@avaterra.pro}"
MH="${MAIL_SMTP_HOST:-mail.avaterra.pro}"

if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then KEY="$HOME/.ssh/avaterra_deploy_nopass"
else KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа SSH: $KEY"; exit 1; }

echo "→ SSH ${USERISH}@${HOST} (smtp_host→${MH}, MAIL_SMTP_USER→${MU})"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=25 "${USERISH}@${HOST}" bash -s -- "$MU" "$MH" <<'REMOTE'
set -euo pipefail
MU="$1"
MH="$2"
ROOT=/opt/ALETHEIA
ENV="$ROOT/.env"
DB="$ROOT/prisma/dev.db"

[[ -f "$ENV" ]] || { echo "Нет $ENV"; exit 1; }
[[ -f "$DB" ]] || { echo "Нет $DB"; exit 1; }

if ! grep -qE '^MAIL_SMTP_USER=' "$ENV"; then
  echo "" >>"$ENV"
  echo "# prod-mail-fix-local-smtp-remote.sh — пароль того же ящика в Mailcow:" >>"$ENV"
  echo "MAIL_SMTP_USER=${MU}" >>"$ENV"
  echo "→ дописан MAIL_SMTP_USER"
else
  echo "→ MAIL_SMTP_USER уже задан в .env"
fi

if ! grep -qE '^MAIL_SMTP_PASSWORD=' "$ENV"; then
  echo "# Раскомментируйте и укажите пароль ящика ${MU} из Mailcow:" >>"$ENV"
  echo "# MAIL_SMTP_PASSWORD=" >>"$ENV"
  echo "→ добавлен закомментированный шаблон MAIL_SMTP_PASSWORD"
fi

ROWS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM SystemSetting WHERE key='smtp_host';")
if [[ "$ROWS" == "1" ]]; then
  sqlite3 "$DB" "UPDATE SystemSetting SET value='${MH}' WHERE key='smtp_host';"
  echo "→ SQLite UPDATE smtp_host"
else
  sqlite3 "$DB" "INSERT INTO SystemSetting (id, key, value, category, updatedAt) VALUES (lower(hex(randomblob(12))), 'smtp_host', '${MH}', 'env', datetime('now'));"
  echo "→ SQLite INSERT smtp_host"
fi


cd "$ROOT"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart aletheia 2>/dev/null || pm2 restart all 2>/dev/null || true
  echo "→ PM2 restart"
elif systemctl is-active --quiet aletheia.service 2>/dev/null; then
  sudo systemctl restart aletheia.service
  echo "→ systemd restart aletheia"
fi

echo ""
echo "ВАЖНО: впишите MAIL_SMTP_PASSWORD в $ENV (одна строка без #), затем снова pm2 restart aletheia."
REMOTE
