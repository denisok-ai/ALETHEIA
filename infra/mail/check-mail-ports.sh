#!/usr/bin/env bash
# Проверка доступности стандартных портов почтового сервера.
# Использование: ./check-mail-ports.sh [HOST]
# По умолчанию HOST=127.0.0.1 (удобно на самом VPS).
set -euo pipefail
HOST="${1:-127.0.0.1}"
PORTS=(25 465 587 993 995)
echo "Checking host=$HOST ports=${PORTS[*]}"
for p in "${PORTS[@]}"; do
  if command -v nc >/dev/null 2>&1; then
    if nc -z -w3 "$HOST" "$p" 2>/dev/null; then
      echo "  $p: open"
    else
      echo "  $p: closed or filtered"
    fi
  elif timeout 2 bash -c "echo >/dev/tcp/$HOST/$p" 2>/dev/null; then
    echo "  $p: open (bash /dev/tcp)"
  else
    echo "  $p: install nc (netcat) for reliable checks"
  fi
done
