#!/usr/bin/env bash
# Деплой без Git: локальная next build → rsync артефактов на VPS → npm ci, prisma generate,
# сброс кеша nginx (каталог /var/cache/nginx при наличии), рестарт aletheia.
#
# ВАЖНО: запускать только на своём ПК (WSL), где есть ~/projects/AVATERRA и npm run build.
# НЕ запускать на VPS (там нет скрипта deploy:rsync в старом package.json и нет ~/projects/...).
#
# Запуск из WSL (прод: root@95.181.224.70 — значение по умолчанию):
#   npm run deploy:rsync
# Другой хост или ключ:
#   export DEPLOY_SSH=root@другой.хост
#   export DEPLOY_SSH_IDENTITY="$HOME/.ssh/ваш_ключ"
#   npm run deploy:rsync
#
# Переменные окружения:
#   DEPLOY_SSH           user@host (по умолчанию root@95.181.224.70)
#   DEPLOY_ROOT          каталог на сервере (по умолчанию /opt/ALETHEIA)
#   DEPLOY_SSH_IDENTITY  путь к приватному ключу SSH (опционально)
#   SKIP_LOCAL_BUILD=1      пропустить npm run build (если .next уже свежий)
#   RESET_AND_SEED=1        на сервере: полный сброс БД (migrate reset + seed). Нужен полный npm ci (tsx для seed).
#   DEPLOY_COPY_LOCAL_DB=1  после синка prisma/* скопировать локальный prisma/dev.db на прод (полная замена файла БД).
#                           Остановка сервиса уже выполнена — файл не должен быть занят. Использовать только если сознательно
#                           заменяете продовые данные локальной SQLite (без git).
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi

DEPLOY_SSH="${DEPLOY_SSH:-${DEPLOY_USER:-root}@${DEPLOY_HOST:-95.181.224.70}}"
DEPLOY_ROOT="${DEPLOY_ROOT:-${DEPLOY_REMOTE_DIR:-/opt/ALETHEIA}}"

ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Тот же ключ, что и в deploy-remote.sh (DEPLOY_SSH_KEY или avaterra_deploy_nopass).
if [[ -z "${DEPLOY_SSH_IDENTITY:-}" && -n "${DEPLOY_SSH_KEY:-}" ]]; then
  DEPLOY_SSH_IDENTITY="$DEPLOY_SSH_KEY"
fi
if [[ -z "${DEPLOY_SSH_IDENTITY:-}" ]]; then
  if [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
    DEPLOY_SSH_IDENTITY="$HOME/.ssh/avaterra_deploy_nopass"
  elif [[ -f "$HOME/.ssh/avaterra_pro_root" ]]; then
    DEPLOY_SSH_IDENTITY="$HOME/.ssh/avaterra_pro_root"
  fi
fi

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
  # next-auth/react при сборке вшивает parseUrl(process.env.NEXTAUTH_URL): пустое значение → падение клиента (/login).
  if [[ -z "${NEXTAUTH_URL:-}" ]]; then
    export NEXTAUTH_URL="https://avaterra.pro"
    echo "   NEXTAUTH_URL не задан в окружении — для сборки задан https://avaterra.pro (задайте свой URL при другом домене)"
  fi
  # Не доверять устаревшему BUILD_COMMIT из окружения (иначе в UI/health — старый sha).
  export BUILD_COMMIT
  BUILD_COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || true)"
  echo "   BUILD_COMMIT=$BUILD_COMMIT"
  # Чистый .next перед сборкой (иначе смесь turbo/webpack или ENOTEMPTY на WSL).
  # Не скрывать stderr и не запускать второй «fallback» next build — частичный .next ломает сборку.
  node scripts/clean-next.mjs
  build_ok=0
  for attempt in 1 2 3; do
    if npm run build:server; then
      build_ok=1
      break
    fi
    echo "(!) Сборка не удалась (попытка $attempt/3). Пауза и повтор после clean-next..."
    sleep 3
    node scripts/clean-next.mjs
    sleep 2
  done
  if [[ "$build_ok" != "1" ]]; then
    echo "Ошибка: next build не собрался после 3 попыток."
    exit 1
  fi
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
# После rsync на 3000 иногда остаётся «осиротевший» next-server (EADDRINUSE у pm2) со старым buildManifest → 404 на новые чанки.
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
REMOTE

echo ""
echo "=== rsync .next (полная замена), public, prisma, конфиги ==="
rsync -avz --delete -e "$RSYNC_RSH" ./.next/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/.next/"
# SCORM на проде живёт только на сервере (импорт ZIP); не затирать public/uploads/scorm при --delete.
rsync -avz --delete --exclude 'uploads/scorm/' -e "$RSYNC_RSH" ./public/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/public/"
# Prisma: без --delete — иначе rsync с --exclude удалит dev.db на сервере.
# Локальные *.db на прод по умолчанию не копируем (см. DEPLOY_COPY_LOCAL_DB).
rsync -avz --exclude 'dev.db' --exclude '*.db' -e "$RSYNC_RSH" ./prisma/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/prisma/"
# Утилиты (импорт/экспорт данных, прочие ts-скрипты) — раньше на сервер не попадали.
rsync -avz --delete -e "$RSYNC_RSH" ./scripts/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/scripts/"
if [[ "${DEPLOY_COPY_LOCAL_DB:-}" = "1" ]]; then
  if [[ ! -f ./prisma/dev.db ]]; then
    echo "Ошибка: DEPLOY_COPY_LOCAL_DB=1, но нет файла ./prisma/dev.db"
    exit 1
  fi
  echo ""
  echo "=== ВНИМАНИЕ: копируем локальный prisma/dev.db на прод (данные на сервере будут заменены) ==="
  rsync -avz -e "$RSYNC_RSH" ./prisma/dev.db "${DEPLOY_SSH}:${DEPLOY_ROOT}/prisma/dev.db"
fi
rsync -avz -e "$RSYNC_RSH" \
  ./package.json \
  ./package-lock.json \
  ./next.config.mjs \
  ./middleware.ts \
  "${DEPLOY_SSH}:${DEPLOY_ROOT}/"

echo ""
echo "=== На сервере: npm ci, prisma, сброс кеша nginx, старт ==="
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "DEPLOY_ROOT='$DEPLOY_ROOT' RESET_AND_SEED='${RESET_AND_SEED:-0}' bash -se" <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_ROOT"
export NODE_ENV=production
rm -rf node_modules
if [[ "${RESET_AND_SEED:-0}" = "1" ]]; then
  echo "RESET_AND_SEED=1 — полный npm ci и prisma migrate reset (данные БД удаляются)"
  npm ci
  npx prisma migrate reset --force
else
  npm ci --omit=dev
  # Раньше ошибки migrate скрывались — страницы с новыми таблицами (Почта и др.) давали 500 на проде.
  npx prisma migrate deploy
  npx prisma generate
fi
if [[ -d /var/cache/nginx ]] && [[ -n "$(ls -A /var/cache/nginx 2>/dev/null)" ]]; then
  sudo sh -c 'rm -rf /var/cache/nginx/*' || true
fi
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t 2>/dev/null && sudo nginx -s reload || true
fi
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
if systemctl list-unit-files 2>/dev/null | grep -q '^aletheia.service'; then
  # restart, не start: иначе при уже активном юните start — no-op, остаётся старый Node с
  # buildManifest в памяти → 404 на новые /_next/static/chunks/*.js после rsync.
  sudo systemctl restart aletheia.service
  sudo systemctl is-active aletheia.service
elif command -v pm2 >/dev/null 2>&1; then
  echo "(!) aletheia.service не найден — fallback pm2 (на проде предпочтителен только systemd)"
  pm2 delete aletheia 2>/dev/null || true
  pm2 start npm --name aletheia --cwd "$DEPLOY_ROOT" -- start
  pm2 save || true
fi
REMOTE

echo ""
echo "=== Готово. Проверьте: curl -sI https://avaterra.pro/ ==="
