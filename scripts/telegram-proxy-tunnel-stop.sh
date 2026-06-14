#!/usr/bin/env bash
# Остановка gost и SSH-туннеля для Telegram-прокси.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.telegram-proxy"
for f in tunnel.pid gost.pid; do
  p="$PID_DIR/$f"
  if [[ -f "$p" ]]; then
    pid=$(cat "$p")
    kill "$pid" 2>/dev/null || true
    rm -f "$p"
    echo "stopped $f ($pid)"
  fi
done
