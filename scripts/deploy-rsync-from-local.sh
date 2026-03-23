#!/usr/bin/env bash
# Деплой без Git: локальная next build → rsync артефактов на VPS → npm ci, prisma generate,
# сброс кеша nginx (каталог /var/cache/nginx при наличии), рестарт aletheia.
#
# Переменные окружения:
#   DEPLOY_SSH           user@host (по умолчанию root@95.181.224.70)
#   DEPLOY_ROOT          каталог на сервере (по умолчанию /opt/ALETHEIA)
#   DEPLOY_SSH_IDENTITY  путь к приватному ключу SSH (опционально)
#   SKIP_LOCAL_BUILD=1   пропустить npm run build (если .next уже свежий)
#
set -euo pipefail

DEPLOY_SSH="${DEPLOY_SSH:-root@95.181.224.70}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
if [[ -n "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  SSH_OPTS+=(-i "$DEPLOY_SSH_IDENTITY")
fi

if [[ -n "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  RSYNC_RSH="ssh -i ${DEPLOY_SSH_IDENTITY} -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"
else
  RSYNC_RSH="ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"
fi

echo "=== Проверка SSH: $DEPLOY_SSH ==="
if ! ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" 'echo OK && hostname'; then
  echo "Ошибка: нет доступа по SSH. Задайте ключ:"
  echo "  export DEPLOY_SSH_IDENTITY=\"\$HOME/.ssh/ваш_ключ\""
  echo "  bash scripts/deploy-rsync-from-local.sh"
  exit 1
fi

if [[ "${SKIP_LOCAL_BUILD:-}" != "1" ]]; then
  echo ""
  echo "=== Локальная сборка (next build) ==="
  npm run build:server 2>/dev/null || npm run build
fi

if [[ ! -d .next/static ]]; then
  echo "Ошибка: нет каталога .next/static — сначала выполните сборку."
  exit 1
fi

echo ""
echo "=== Остановка приложения на сервере ==="
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "DEPLOY_ROOT='$DEPLOY_ROOT' bash -se" <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_ROOT"
if systemctl is-active --quiet aletheia.service 2>/dev/null; then
  sudo systemctl stop aletheia.service
elif command -v pm2 >/dev/null 2>&1 && pm2 describe aletheia &>/dev/null; then
  pm2 stop aletheia
fi
REMOTE

echo ""
echo "=== rsync .next (полная замена), public, prisma, конфиги ==="
rsync -avz --delete -e "$RSYNC_RSH" ./.next/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/.next/"
rsync -avz --delete -e "$RSYNC_RSH" ./public/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/public/"
rsync -avz --delete -e "$RSYNC_RSH" ./prisma/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/prisma/"
rsync -avz -e "$RSYNC_RSH" \
  ./package.json \
  ./package-lock.json \
  ./next.config.mjs \
  ./middleware.ts \
  "${DEPLOY_SSH}:${DEPLOY_ROOT}/"

echo ""
echo "=== На сервере: npm ci, prisma generate, сброс кеша nginx, старт ==="
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "DEPLOY_ROOT='$DEPLOY_ROOT' bash -se" <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_ROOT"
export NODE_ENV=production
rm -rf node_modules
npm ci --omit=dev
npx prisma generate
if [[ -d /var/cache/nginx ]] && [[ -n "$(ls -A /var/cache/nginx 2>/dev/null)" ]]; then
  sudo sh -c 'rm -rf /var/cache/nginx/*' || true
fi
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t 2>/dev/null && sudo nginx -s reload || true
fi
if systemctl list-unit-files 2>/dev/null | grep -q '^aletheia.service'; then
  sudo systemctl start aletheia.service
  sudo systemctl is-active aletheia.service
elif command -v pm2 >/dev/null 2>&1; then
  pm2 restart aletheia 2>/dev/null || pm2 start npm --name aletheia --cwd "$DEPLOY_ROOT" -- start
  pm2 save || true
fi
REMOTE

echo ""
echo "=== Готово. Проверьте: curl -sI https://avaterra.pro/ ==="
