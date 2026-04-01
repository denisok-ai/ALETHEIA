#!/bin/bash
# Выгрузка с гита на сервере: pull → install → migrate → build → restart → очистка proxy_cache nginx.
# Запускать на сервере:
#   cd /opt/ALETHEIA && sudo bash scripts/deploy-pull.sh
# (sudo нужен для restart unit-а и для шага 5b — сброс /var/cache/nginx + reload nginx.)
# Путь проекта по умолчанию: /opt/ALETHEIA (переопределить через DEPLOY_ROOT=/реальный/каталог/репозитория)
# Без сброса кеша nginx: SKIP_NGINX_CACHE=1 bash scripts/deploy-pull.sh
#
# Тестовый стенд (БД удаляется, затем миграции + prisma/seed.ts):
#   RESET_AND_SEED=1 bash scripts/deploy-pull.sh

set -e

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
PM2_NAME="${PM2_NAME:-aletheia}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$DEPLOY_ROOT"
echo "=== Выгрузка с Git: $DEPLOY_ROOT (ветка: $GIT_BRANCH) ==="

echo ""
echo "1. Git pull..."
git fetch origin
# Сбросить локальные изменения в dev.db (на проде не нужен)
git checkout -- prisma/dev.db 2>/dev/null || true
git pull origin "$GIT_BRANCH"
echo "   OK"

echo ""
echo "2. npm install..."
npm ci 2>/dev/null || npm install
echo "   OK"

echo ""
echo "3. Prisma..."
npx prisma generate
if [ "${RESET_AND_SEED:-}" = "1" ]; then
  echo "   RESET_AND_SEED=1 — сброс БД, миграции и seed (все данные удаляются)"
  npx prisma migrate reset --force
else
  npx prisma migrate deploy 2>/dev/null || echo "   (миграции не требуются)"
fi
echo "   OK"

echo ""
echo "4. Build..."
# GA/Clarity и прочие NEXT_PUBLIC_* вшиваются при сборке; runtime next start должен быть с NODE_ENV=production (см. scripts/systemd/aletheia.service.example).
# Полное удаление .next: иначе после прерванной/OOM-сборки или смены webpack-чанков
# HTML может ссылаться на chunk (например 5878-*.js), а файл на диске отсутствует или битый —
# браузер получает 400/ошибку загрузки чанка и ломается весь клиентский React.
export BUILD_COMMIT
BUILD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || true)"
echo "   BUILD_COMMIT=$BUILD_COMMIT (вшивается в NEXT_PUBLIC_BUILD_COMMIT при next build)"
rm -rf .next
npm run build:server 2>/dev/null || npm run build
echo "   OK"

echo ""
echo "5. Restart..."
DEPLOY_ABS="$(pwd -P)"
SVC_WD="$(systemctl show aletheia.service -p WorkingDirectory --value 2>/dev/null || true)"
if [ -n "$SVC_WD" ] && [ -d "$SVC_WD" ]; then
  SVC_ABS="$(cd "$SVC_WD" && pwd -P)"
  if [ "$DEPLOY_ABS" != "$SVC_ABS" ]; then
    echo "   ВНИМАНИЕ: WorkingDirectory unit-файла ($SVC_ABS) ≠ каталог деплоя ($DEPLOY_ABS)."
    echo "   Сборка здесь, сервис стартует из другой папки → часто 502. Исправьте WorkingDirectory= в /etc/systemd/system/aletheia.service и: sudo systemctl daemon-reload && sudo systemctl restart aletheia.service"
  fi
fi
if systemctl is-active --quiet aletheia.service 2>/dev/null; then
  sudo systemctl restart aletheia.service
  echo "   systemd: aletheia.service перезапущен"
elif pm2 describe "$PM2_NAME" &>/dev/null; then
  pm2 restart "$PM2_NAME"
  echo "   PM2: $PM2_NAME перезапущен"
else
  echo "   PM2 и systemd (aletheia) не найдены."
  echo "   Запустите вручную: sudo systemctl restart aletheia.service"
fi
echo "   OK"

echo ""
echo "5b. Кеш nginx (proxy_cache)..."
# Сброс старого HTML/RSC из nginx после выката. Пропуск: SKIP_NGINX_CACHE=1
if [ "${SKIP_NGINX_CACHE:-0}" != "1" ]; then
  CLEAR_SCRIPT="$(cd "$(dirname "$0")" && pwd)/nginx-clear-proxy-cache.sh"
  if [ -x "$CLEAR_SCRIPT" ] || [ -f "$CLEAR_SCRIPT" ]; then
    if [ "$(id -u)" -eq 0 ]; then
      NGINX_RELOAD=1 bash "$CLEAR_SCRIPT" || echo "   Предупреждение: очистка кеша nginx не удалась."
    elif sudo -n true 2>/dev/null; then
      sudo NGINX_RELOAD=1 bash "$CLEAR_SCRIPT" || echo "   Предупреждение: очистка кеша nginx не удалась."
    else
      echo "   Пропуск: нет root и нет passwordless sudo — выполните вручную:"
      echo "     sudo bash $CLEAR_SCRIPT"
    fi
  else
    echo "   (нет отдельного скрипта — встроенная очистка proxy_cache)"
    NGINX_CACHE_ROOT="${NGINX_CACHE_ROOT:-/var/cache/nginx}"
    _clear_nginx_cache() {
      [ -d "$NGINX_CACHE_ROOT" ] || return 0
      find "$NGINX_CACHE_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
      echo "   очищено: $NGINX_CACHE_ROOT"
      if command -v nginx >/dev/null 2>&1; then
        nginx -t && systemctl reload nginx && echo "   nginx reload OK" || echo "   предупреждение: nginx -t или reload не прошли"
      fi
    }
    if [ "$(id -u)" -eq 0 ]; then
      _clear_nginx_cache
    elif sudo -n true 2>/dev/null; then
      sudo NGINX_CACHE_ROOT="$NGINX_CACHE_ROOT" bash -c '
        CR="${NGINX_CACHE_ROOT:-/var/cache/nginx}"
        [ -d "$CR" ] && find "$CR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
        echo "   очищено: $CR"
        command -v nginx >/dev/null && nginx -t && systemctl reload nginx && echo "   nginx reload OK" || true
      ' || echo "   Предупреждение: встроенная очистка nginx не удалась."
    else
      echo "   Нужен root/sudo. Вручную:"
      echo "     sudo find $NGINX_CACHE_ROOT -mindepth 1 -maxdepth 1 -exec rm -rf {} + && sudo nginx -t && sudo systemctl reload nginx"
    fi
  fi
else
  echo "   SKIP_NGINX_CACHE=1 — очистка пропущена"
fi

# Порт как у nginx proxy_pass (см. scripts/nginx-aletheia.conf). Переопределение: export APP_PORT=3001
APP_PORT="${APP_PORT:-${PORT:-3000}}"

echo ""
echo "6. Проверка Node (upstream nginx)..."
echo "   (502 от nginx = нет ответа на 127.0.0.1:$APP_PORT, это не «кеш страницы»)"
if command -v curl >/dev/null 2>&1; then
  LOCAL_HEALTH="http://127.0.0.1:${APP_PORT}/api/health"
  local_code="000"
  for _i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    local_code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 "$LOCAL_HEALTH" 2>/dev/null || echo "000")
    if [ "$local_code" = "200" ]; then break; fi
    sleep 2
  done
  echo "   $LOCAL_HEALTH → HTTP $local_code"
  if [ "$local_code" != "200" ]; then
    echo "   ОШИБКА: приложение не поднялось на порту $APP_PORT — с внешки будет 502."
    echo "   Диагностика:"
    echo "     sudo systemctl status aletheia.service --no-pager -l"
    echo "     sudo journalctl -u aletheia.service -n 60 --no-pager"
    if systemctl is-active --quiet aletheia.service 2>/dev/null; then
      echo "   --- journalctl (последние строки) ---"
      sudo journalctl -u aletheia.service -n 40 --no-pager 2>/dev/null || true
    fi
  fi
else
  echo "   (curl нет — пропуск локальной проверки)"
fi

echo ""
echo "7. Проверка ответа сайта снаружи..."
if command -v curl >/dev/null 2>&1; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 https://avaterra.pro/ 2>/dev/null || echo "000")
  echo "   https://avaterra.pro/ → HTTP $code"
  if [ "$code" = "502" ] || [ "$code" = "503" ]; then
    echo "   Если шаг 6 показал не 200 — чините падение Node (логи выше). Если шаг 6 = 200 — проверьте nginx (proxy_pass порт, SSL upstream)."
  fi
  html=$(curl -sS --max-time 20 https://avaterra.pro/ 2>/dev/null || true)
  chunk_path=$(printf '%s' "$html" | grep -oE '"/_next/static/chunks/[0-9]+-[a-f0-9]+\.js"' | head -1 | tr -d '"')
  if [ -n "$chunk_path" ]; then
    ccode=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "https://avaterra.pro${chunk_path}" 2>/dev/null || echo "000")
    echo "   JS-чанк из HTML ${chunk_path} → HTTP $ccode"
    if [ "$ccode" != "200" ]; then
      echo "   ВНИМАНИЕ: чанк не отдаётся 200 — часто из-за кеша HTML или неполного деплоя .next/static. Сбросьте кеш прокси и убедитесь, что после build перезапущен next start."
    fi
  fi
  echo "   /api/health (version, commit):"
  curl -sS --max-time 10 "https://avaterra.pro/api/health" 2>/dev/null || echo "   (не удалось запросить)"
else
  echo "   (curl нет — пропуск)"
fi

echo ""
echo "=== Готово. Код обновлён и приложение перезапущено. ==="
