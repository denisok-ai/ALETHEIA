#!/usr/bin/env bash
# Дописывает в .env прод режим «свой SMTP из MAIL_SMTP_*» (перебивает БД и приоритет Resend).
# Пароль ящика вставьте вручную: MAIL_SMTP_PASSWORD="..."
#
# На VPS: sudo bash scripts/append-own-smtp-env-prod.sh
set -euo pipefail
ENV_FILE="${ENV_FILE:-/opt/ALETHEIA/.env}"

append_kv() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    echo "skip exists: $key"
    return
  fi
  printf '\n%s=%s\n' "$key" "$val" >>"$ENV_FILE"
  echo "appended $key"
}

test -f "$ENV_FILE" || { echo "Нет файла $ENV_FILE" >&2; exit 1; }

append_kv MAIL_USE_OWN_SMTP true
append_kv EMAIL_TRANSPORT smtp

echo ""
echo "Дальше в $ENV_FILE задайте MAIL_SMTP_USER и MAIL_SMTP_PASSWORD для ящика на Mailcow (тот же хост, что MAIL_SMTP_HOST)."
echo "В админке Портал → Настройки поле «Email отправителя» должно совпадать с этим ящиком."
