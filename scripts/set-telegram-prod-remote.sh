#!/usr/bin/env bash
# Настройка @AvaterraProBot на проде: секреты в БД, webhook с локальной машины, проверка.
# TELEGRAM_BOT_TOKEN обязателен в env (не коммитить).
# Локально: TELEGRAM_BOT_TOKEN='...' bash scripts/set-telegram-prod-remote.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT="$ROOT/telegram-setup-report.txt"
# shellcheck source=/dev/null
source "$ROOT/scripts/.deploy.env"

TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "Задайте TELEGRAM_BOT_TOKEN в окружении" >&2
  exit 1
fi

WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-$(openssl rand -hex 32)}"
WEBHOOK_URL="https://avaterra.pro/api/portal/telegram/webhook"
MASKED="${TOKEN%%:*}:…${TOKEN: -4}"

SSH=(ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${DEPLOY_HOST}")

exec > >(tee "$REPORT") 2>&1
echo "=== Telegram setup $(date -Iseconds) token=$MASKED ==="

echo ">>> Step 2: getMe (local)"
GETME=$(curl -sS "https://api.telegram.org/bot${TOKEN}/getMe")
echo "$GETME"
if echo "$GETME" | grep -q '"username":"AvaterraProBot"'; then
  echo "CONFIRMED getMe: @AvaterraProBot"
else
  echo "FAIL getMe: unexpected username"
  exit 1
fi

echo ">>> Step 3: scp + encrypt secrets on VPS"
scp -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new \
  "$ROOT/scripts/telegram-prod-set-secrets.ts" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_REMOTE_DIR}/scripts/"

"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
cd ${DEPLOY_REMOTE_DIR}
TELEGRAM_BOT_TOKEN='${TOKEN}' TELEGRAM_WEBHOOK_SECRET='${WEBHOOK_SECRET}' \
  npx tsx scripts/telegram-prod-set-secrets.ts
REMOTE
echo "CONFIRMED secrets in DB"

echo ">>> Step 4: setWebhook (local)"
SETWH=$(curl -sS -G "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" \
  --data-urlencode "secret_token=${WEBHOOK_SECRET}" \
  --data-urlencode "drop_pending_updates=true")
echo "$SETWH"
if echo "$SETWH" | grep -q '"ok":true'; then
  echo "CONFIRMED setWebhook"
else
  echo "FAIL setWebhook"
  exit 1
fi

echo ">>> Step 5: getWebhookInfo (local)"
WHINFO=$(curl -sS "https://api.telegram.org/bot${TOKEN}/getWebhookInfo")
echo "$WHINFO"
if echo "$WHINFO" | grep -q "\"url\":\"${WEBHOOK_URL}\""; then
  echo "CONFIRMED getWebhookInfo url"
else
  echo "FAIL getWebhookInfo url"
  exit 1
fi

echo ">>> Step 6: restart aletheia"
"${SSH[@]}" bash -s <<REMOTE
set -euo pipefail
systemctl restart aletheia
sleep 3
systemctl is-active aletheia
REMOTE
echo "CONFIRMED aletheia restart"

echo ">>> Step 7: webhook endpoint"
HTTP_NO_SECRET=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" -d '{"message":{"chat":{"id":1},"text":"/start"}}' || echo "000")
echo "POST without secret: HTTP $HTTP_NO_SECRET"
if [[ "$HTTP_NO_SECRET" == "401" ]]; then
  echo "CONFIRMED webhook rejects without secret"
else
  echo "WARN webhook without secret: expected 401, got $HTTP_NO_SECRET"
fi

HTTP_WITH_SECRET=$(curl -sS -w "\nHTTP_CODE:%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: ${WEBHOOK_SECRET}" \
  -d '{"message":{"chat":{"id":1},"text":"/start"}}' || true)
echo "$HTTP_WITH_SECRET"
if echo "$HTTP_WITH_SECRET" | grep -q "HTTP_CODE:200"; then
  echo "CONFIRMED webhook accepts with secret"
else
  echo "WARN webhook with secret — check response above"
fi

echo ">>> Step 8: prod telegram API (may need HTTPS_PROXY for outgoing)"
"${SSH[@]}" bash -s <<'REMOTE'
curl -sS -o /dev/null -w "api.telegram.org http_code=%{http_code}\n" --connect-timeout 8 https://api.telegram.org || echo "api.telegram.org: blocked"
grep -E '^(HTTPS_PROXY|HTTP_PROXY)=' /opt/ALETHEIA/.env 2>/dev/null | sed 's/=.*/=***/' || echo "no proxy in .env"
REMOTE

echo "=== DONE ==="
echo "Webhook secret saved in DB (not printed). Test in Telegram: open @AvaterraProBot, /start, /admin_on"
echo "Outgoing sendMessage from server needs HTTPS_PROXY if api.telegram.org blocked on VPS."
