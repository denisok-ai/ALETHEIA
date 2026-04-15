#!/bin/bash
# Сброс файлового кеша nginx (proxy_cache_path) и безопасный reload.
# После деплоя Next.js иначе могут отдаваться старые HTML/RSC до истечения proxy_cache_valid.
#
# Запуск на сервере (нужен root):
#   sudo bash scripts/nginx-clear-proxy-cache.sh
#
# Каталог кеша: как в nginx.conf (proxy_cache_path). Переопределение:
#   sudo NGINX_CACHE_ROOT=/var/cache/nginx bash scripts/nginx-clear-proxy-cache.sh
#
# Только очистка без reload:
#   NGINX_RELOAD=0 sudo -E bash scripts/nginx-clear-proxy-cache.sh

set -euo pipefail

NGINX_CACHE_ROOT="${NGINX_CACHE_ROOT:-/var/cache/nginx}"
NGINX_RELOAD="${NGINX_RELOAD:-1}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Ошибка: нужен root (очистка $NGINX_CACHE_ROOT и при необходимости reload nginx)." >&2
  echo "Запустите: sudo bash $(readlink -f "$0" 2>/dev/null || echo "$0")" >&2
  exit 1
fi

if [ ! -d "$NGINX_CACHE_ROOT" ]; then
  echo "Каталог кеша не найден: $NGINX_CACHE_ROOT — proxy_cache, вероятно, не используется; очистка пропущена."
  if [ "$NGINX_RELOAD" = "1" ] && command -v nginx >/dev/null 2>&1; then
    nginx -t && systemctl reload nginx && echo "nginx reload OK (после деплоя)." || true
  fi
  exit 0
fi

echo "Очистка proxy_cache: $NGINX_CACHE_ROOT"
# Удаляем только содержимое, не сам корень (чтобы не ломать mount/права).
find "$NGINX_CACHE_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
echo "   OK"

if [ "$NGINX_RELOAD" = "1" ]; then
  if command -v nginx >/dev/null 2>&1; then
    echo "nginx -t..."
    nginx -t
    echo "systemctl reload nginx..."
    systemctl reload nginx
    echo "   OK"
  else
    echo "   (nginx не в PATH — reload пропущен)"
  fi
fi
