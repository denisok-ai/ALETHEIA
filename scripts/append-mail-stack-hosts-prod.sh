#!/usr/bin/env bash
# Дописывает в /opt/ALETHEIA/.env хосты встроенного почтовика (если строк ещё нет).
# Учётные данные SMTP/IMAP (MAIL_SMTP_USER/PASSWORD) нужно задать вручную или через админку «Доставка».
#
# Запуск на VPS: sudo bash scripts/append-mail-stack-hosts-prod.sh
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

append_kv MAIL_IMAP_HOST mail.avaterra.pro
append_kv MAIL_IMAP_PORT 993
append_kv MAIL_SMTP_HOST mail.avaterra.pro
append_kv MAIL_SMTP_PORT 587
append_kv MAIL_DOMAIN avaterra.pro
