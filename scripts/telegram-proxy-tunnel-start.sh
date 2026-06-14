#!/usr/bin/env bash
# Локальный HTTP-прокси (gost) + reverse SSH на VPS для исходящих запросов к api.telegram.org.
# Запуск: bash scripts/telegram-proxy-tunnel-start.sh
# Остановка: bash scripts/telegram-proxy-tunnel-stop.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.telegram-proxy"
GOST_PID="$PID_DIR/gost.pid"
TUN_PID="$PID_DIR/tunnel.pid"
GOST_PORT="${GOST_LOCAL_PORT:-8899}"
VPS_PORT="${GOST_VPS_PORT:-18080}"
GOST_BIN="${GOST_BIN:-gost}"

mkdir -p "$PID_DIR"
# shellcheck source=/dev/null
source "$ROOT/scripts/.deploy.env"

if ! command -v "$GOST_BIN" >/dev/null 2>&1; then
  echo "gost не найден. Установите: go install github.com/go-gost/gost/cmd/gost@latest" >&2
  echo "или скачайте бинарник в PATH." >&2
  exit 1
fi

if [[ -f "$GOST_PID" ]] && kill -0 "$(cat "$GOST_PID")" 2>/dev/null; then
  echo "gost уже запущен (pid $(cat "$GOST_PID"))"
else
  nohup "$GOST_BIN" -L "http://127.0.0.1:${GOST_PORT}" >/dev/null 2>&1 &
  echo $! > "$GOST_PID"
  sleep 1
  if curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 3 -x "http://127.0.0.1:${GOST_PORT}" https://api.telegram.org/ | grep -qE '302|200'; then
    echo "gost OK на 127.0.0.1:${GOST_PORT}"
  else
    echo "gost не проксирует Telegram — проверьте сеть WSL" >&2
    exit 1
  fi
fi

if [[ -f "$TUN_PID" ]] && kill -0 "$(cat "$TUN_PID")" 2>/dev/null; then
  echo "SSH-туннель уже запущен (pid $(cat "$TUN_PID"))"
else
  ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -R "127.0.0.1:${VPS_PORT}:127.0.0.1:${GOST_PORT}" \
    -N "${DEPLOY_USER}@${DEPLOY_HOST}" &
  echo $! > "$TUN_PID"
  sleep 2
  echo "SSH-туннель VPS:127.0.0.1:${VPS_PORT} → local:${GOST_PORT}"
fi

ssh -i "$DEPLOY_SSH_KEY" -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<REMOTE
set -euo pipefail
ENV=/opt/ALETHEIA/.env
PROXY="http://127.0.0.1:${VPS_PORT}"
touch "\$ENV"
chmod 600 "\$ENV"
for key in HTTPS_PROXY HTTP_PROXY; do
  if grep -q "^\${key}=" "\$ENV" 2>/dev/null; then
    sed -i "s|^\${key}=.*|\${key}=\${PROXY}|" "\$ENV"
  else
    echo "\${key}=\${PROXY}" >> "\$ENV"
  fi
done
systemctl restart aletheia
sleep 2
systemctl is-active aletheia
code=\$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 8 -x "\$PROXY" https://api.telegram.org/ || echo 000)
echo "VPS proxy test http_code=\$code"
REMOTE

echo "Готово. Проверьте @AvaterraProBot: /start"
