#!/usr/bin/env bash
# Держит домашний Telegram-мост для прода: CONNECT-прокси (127.0.0.1:3129) и
# обратный SSH-туннель на VPS (там 127.0.0.1:18081 → сюда). Автоперезапуск обоих.
# Запуск: tmux new-session -d -s tg-egress "bash <путь>/telegram-egress-home.sh"
# Автозагрузка: crontab-строка @reboot с той же командой.
set -u

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPS=root@95.181.224.70

node "$DIR/telegram-connect-proxy.mjs" &
PROXY_PID=$!
trap 'kill $PROXY_PID 2>/dev/null' EXIT

while true; do
  ssh -N \
    -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes -o BatchMode=yes \
    -o StrictHostKeyChecking=accept-new \
    -R 127.0.0.1:18081:127.0.0.1:3129 "$VPS"
  echo "$(date -Is) туннель упал, перезапуск через 10 с"
  sleep 10
  # если прокси умер — поднять
  kill -0 $PROXY_PID 2>/dev/null || { node "$DIR/telegram-connect-proxy.mjs" & PROXY_PID=$!; }
done
