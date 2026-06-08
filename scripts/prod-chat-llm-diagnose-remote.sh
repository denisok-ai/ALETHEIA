#!/usr/bin/env bash
# Одна команда для проверки LLM чата на проде: код /api/chat, метаданные БД (без секретов), наличие строк в .env.
# bash scripts/prod-chat-llm-diagnose-remote.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
KEY="${DEPLOY_SSH_KEY:-}"
[[ -z "$KEY" || ! -f "$KEY" ]] && KEY="$HOME/.ssh/avaterra_deploy_nopass"
[[ ! -f "$KEY" ]] && KEY="$HOME/.ssh/avaterra_pro_root"
ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=25 "${USER}@${HOST}" bash -se <<'REMOTE'
set -uo pipefail
ROOT=/opt/ALETHEIA
DB="$ROOT/prisma/dev.db"

echo "--- POST /api/chat (127.0.0.1:3000) ---"
curl -sS -m 25 -o /tmp/chat_body.json -w 'HTTP %{http_code}\n' -X POST 'http://127.0.0.1:3000/api/chat' \
  -H 'Content-Type: application/json' -d '{"message":"diag ping"}'
head -c 300 /tmp/chat_body.json | tr '\r\n' '  '
echo ""
echo ""

if [[ -f "$DB" ]]; then
  echo "--- LlmSetting chatbot + LlmApiKey (длина ciphertext) ---"
  sqlite3 "$DB" "SELECT ls.key, ls.\"model\", ls.apiKeyId, ak.id AS joined_id, length(ak.apiKeyEncrypted) AS enc_len
    FROM LlmSetting ls LEFT JOIN LlmApiKey ak ON ak.id = ls.apiKeyId WHERE ls.key='chatbot';" || true
  echo ""
  echo "--- SystemSetting: deepseek/openai (строк есть?) ---"
  sqlite3 "$DB" "SELECT key, length(value) FROM SystemSetting WHERE key IN ('deepseek_api_key','openai_api_key');" || true
  echo "(пусто = в админке «Переменные окружения» ключ не задавали)"
fi
echo ""
echo "--- .env: непустые DEEPSEEK/OPENAI (только счётчик строк, без значений) ---"
if [[ -f "$ROOT/.env" ]]; then
  o=$(grep -cE '^[[:space:]]*OPENAI_API_KEY=\S+' "$ROOT/.env" 2>/dev/null || true)
  d=$(grep -cE '^[[:space:]]*DEEPSEEK_API_KEY=\S+' "$ROOT/.env" 2>/dev/null || true)
  echo ".env OPENAI nonempty lines: $o"
  echo ".env DEEPSEEK nonempty lines: $d"
else
  echo ".env отсутствует"
fi
REMOTE
