#!/usr/bin/env bash
# Одноразово: сбросить nextauth_url в продовой SQLite (одним подключением к sqlite) и перезапустить aletheia.
# Запуск из WSL: bash scripts/prod-fix-nextauth-url.sh
set -euo pipefail
KEY="${DEPLOY_SSH_IDENTITY:-$HOME/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_SSH:-root@95.181.224.70}"

ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25 -i "$KEY" "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/ALETHEIA
DB_URL=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
echo "DATABASE_URL prefix: ${DB_URL:0:50}..."
if [[ "$DB_URL" == file:./* ]]; then
  DB_FILE="/opt/ALETHEIA/${DB_URL#file:./}"
elif [[ "$DB_URL" == file:* ]]; then
  DB_FILE="${DB_URL#file:}"
else
  DB_FILE=""
fi
if [[ ! -f "$DB_FILE" && -f /opt/ALETHEIA/prisma/dev.db ]]; then
  DB_FILE=/opt/ALETHEIA/prisma/dev.db
fi
if [[ ! -f "$DB_FILE" ]]; then
  echo "БД не найдена (распарсили: ${DB_FILE:-пусто})"
  exit 1
fi
echo "Используем файл БД: $DB_FILE"
echo "--- nextauth_url до ---"
sqlite3 "$DB_FILE" "SELECT key, value FROM SystemSetting WHERE key='nextauth_url';" || true
CHANGES=$(sqlite3 "$DB_FILE" "UPDATE SystemSetting SET value = '' WHERE key='nextauth_url'; SELECT changes();")
echo "Обновлено строк: $CHANGES"
if [[ "$CHANGES" == "0" ]]; then
  sqlite3 "$DB_FILE" "INSERT INTO SystemSetting (id, key, value, category, updatedAt) VALUES ('cfix-nextauth-url', 'nextauth_url', '', 'env', datetime('now'));"
fi
echo "--- nextauth_url после ---"
sqlite3 "$DB_FILE" "SELECT key, quote(value) FROM SystemSetting WHERE key='nextauth_url';"
systemctl restart aletheia
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if systemctl is-active --quiet aletheia 2>/dev/null; then
    echo "aletheia: active"
    break
  fi
  echo "aletheia: ожидание… ($i)"
done
systemctl is-active aletheia || true
curl -sS -o /dev/null -w "health HTTP %{http_code}\n" "http://127.0.0.1:3000/api/health" || true
REMOTE
echo "Готово."
