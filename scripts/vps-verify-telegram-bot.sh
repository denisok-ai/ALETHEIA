#!/bin/bash
set -euo pipefail
set -a
source /opt/ALETHEIA/.env
set +a
curl -sS -o /dev/null -w "proxy_telegram=%{http_code}\n" --connect-timeout 15 -x http://127.0.0.1:18080 https://api.telegram.org/
WH=$(curl -sS --connect-timeout 15 -x http://127.0.0.1:18080 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
python3 -c "import json,sys; d=json.loads(sys.argv[1]).get('result',{}); print('webhook_pending', d.get('pending_update_count')); print('webhook_last_error', d.get('last_error_message') or '(none)'); print('webhook_url_ok', bool(d.get('url')))" "$WH"
cd /opt/ALETHEIA
/root/.nvm/versions/node/v22.22.0/bin/npx tsx scripts/simulate-telegram-webhook.ts
