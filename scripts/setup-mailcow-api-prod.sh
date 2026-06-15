#!/usr/bin/env bash
# Создаёт ключ Mailcow REST API (rw) и дописывает MAILCOW_* / MAIL_PROVISIONING_MODE в /opt/ALETHEIA/.env.
# Запуск на VPS: sudo bash scripts/setup-mailcow-api-prod.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/ALETHEIA/.env}"
MAILCOW_DIR="${MAILCOW_DIR:-/opt/mailcow-dockerized}"
MAILCOW_API_URL="${MAILCOW_API_URL:-https://mail.avaterra.pro}"

append_kv() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    echo "updated $key"
  else
    printf '\n%s=%s\n' "$key" "$val" >>"$ENV_FILE"
    echo "appended $key"
  fi
}

test -f "$ENV_FILE" || { echo "Нет $ENV_FILE" >&2; exit 1; }
test -f "$MAILCOW_DIR/mailcow.conf" || { echo "Нет $MAILCOW_DIR/mailcow.conf" >&2; exit 1; }

# shellcheck disable=SC1091
source "$MAILCOW_DIR/mailcow.conf"

MYSQL_C="$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/ {print; exit}')"
[[ -n "$MYSQL_C" ]] || { echo "Контейнер mysql-mailcow не найден" >&2; exit 1; }

EXISTING_COUNT="$(docker exec "$MYSQL_C" mysql -N -u"$DBUSER" -p"$DBPASS" "$DBNAME" \
  -e "SELECT COUNT(*) FROM api WHERE active=1;" 2>/dev/null || echo 0)"

if [[ "$EXISTING_COUNT" -gt 0 ]]; then
  API_KEY_LEN="$(docker exec "$MYSQL_C" mysql -N -u"$DBUSER" -p"$DBPASS" "$DBNAME" \
    -e "SELECT LENGTH(api_key) FROM api WHERE active=1 ORDER BY api_key LIMIT 1;" 2>/dev/null || true)"
  echo "В Mailcow уже есть active API key (len=${API_KEY_LEN:-?}); новый не создаём."
  API_KEY="$(docker exec "$MYSQL_C" mysql -N -u"$DBUSER" -p"$DBPASS" "$DBNAME" \
    -e "SELECT api_key FROM api WHERE active=1 ORDER BY api_key LIMIT 1;" 2>/dev/null)"
else
  API_KEY="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  docker exec -i "$MYSQL_C" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" <<SQL
INSERT INTO api (api_key, active, allow_from, skip_ip_check, access)
VALUES ('${API_KEY}', 1, '', 1, 'rw');
SQL
  echo "Создан новый Mailcow API key (len=${#API_KEY})"
fi

append_kv MAIL_PROVISIONING_MODE mailcow
append_kv MAILCOW_API_URL "$MAILCOW_API_URL"
append_kv MAILCOW_API_KEY "$API_KEY"

if systemctl is-active --quiet aletheia 2>/dev/null; then
  systemctl restart aletheia
  echo "aletheia.service перезапущен"
fi

echo "Готово. Провижининг ящиков из админки теперь идёт через Mailcow API."
