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
echo "=== Фаза 1: rsync артефактов БЕЗ простоя (приложение продолжает работать) ==="
# Near-zero-downtime (14.08.2026): тяжёлый rsync делаем, пока приложение живо.
# Источники безопасны при работающем инстансе — в рантайме он использует .next,
# а не TS-исходники; конфиги читаются только при старте (в памяти — старые).
# .next кладём в STAGING (.next.incoming), НЕ поверх живого: иначе rsync --delete
# сносит чанки, на которые ссылается уже отданный клиенту HTML → 404 у живых
# пользователей. Подмена (.next.incoming → .next) — в коротком окне простоя ниже.
rsync -avz --delete -e "$RSYNC_RSH" ./.next/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/.next.incoming/"
# SCORM на проде живёт только на сервере (импорт ZIP); не затирать public/uploads/scorm при --delete.
# Исключается ВЕСЬ uploads/, а не только scorm. В public/ синхронизация идёт с
# --delete, то есть файлы, которых нет локально, на проде удаляются. А uploads —
# это пользовательские данные, живущие только на сервере: видео-верификации
# студентов, файлы медиатеки, картинки товаров. Стоило студенту загрузить видео
# на прод — и следующий деплой с машины разработчика, где этого файла нет, стёр
# бы его безвозвратно. Раньше исключён был только scorm, остальное держалось на
# случайном совпадении: локальная копия содержала те же файлы.
rsync -avz --delete --exclude 'uploads/' -e "$RSYNC_RSH" ./public/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/public/"
# Исходники бота и API (раньше lib/ не синкался — на проде оставался старый код).
rsync -avz --delete -e "$RSYNC_RSH" ./lib/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/lib/"
rsync -avz --delete -e "$RSYNC_RSH" ./app/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/app/"
# React-компоненты (раньше не синкались — на проде server build падал на @/components/ui/PasswordInput и др.).
rsync -avz --delete -e "$RSYNC_RSH" ./components/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/components/"
# Prisma: без --delete — иначе rsync с --exclude удалит dev.db на сервере.
# Локальные *.db на прод по умолчанию не копируем (см. DEPLOY_COPY_LOCAL_DB).
# Перед синком prisma/ сбрасываем журнал WAL прода в основной файл БД: тогда
# даже при ошибке в исключениях rsync свежие транзакции уже в dev.db, а не
# только в спутнике -wal. Вторая линия защиты к исключению ниже.
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "cd '$DEPLOY_ROOT' && sqlite3 prisma/dev.db 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null 2>&1" || true

# Шаблон 'dev.db*' обязателен: прежние '--exclude dev.db --exclude *.db' НЕ
# покрывали спутников WAL — dev.db-wal и dev.db-shm. С 19.07.2026 приложение
# работает в режиме WAL, и деплой начал копировать ЛОКАЛЬНЫЙ (пустой) журнал
# поверх боевого, уничтожая транзакции прода, ещё не сброшенные в основной файл.
# Обнаружено сквозной проверкой: тестовый заказ с оплатой исчез после деплоя.
# Реальная оплата, пришедшая незадолго до выкладки, пропала бы так же — молча.
rsync -avz --exclude 'dev.db*' --exclude '*.db' -e "$RSYNC_RSH" ./prisma/ "${DEPLOY_SSH}:${DEPLOY_ROOT}/prisma/"
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
  ./instrumentation.ts \
  ./tsconfig.json \
  ./tailwind.config.ts \
  ./postcss.config.mjs \
  ./next-env.d.ts \
  "${DEPLOY_SSH}:${DEPLOY_ROOT}/"

echo ""
echo "=== Фаза 2: подготовка + короткое окно простоя (swap + рестарт) ==="
ssh "${SSH_OPTS[@]}" "$DEPLOY_SSH" "DEPLOY_ROOT='$DEPLOY_ROOT' RESET_AND_SEED='${RESET_AND_SEED:-0}' bash -se" <<'REMOTE'
set -euo pipefail
cd "$DEPLOY_ROOT"
export NODE_ENV=production

# Аварийная страховка: при ЛЮБОМ обрыве приложение и воркеры должны подняться,
# а .next — не остаться снесённым (восстановить из .next.old, если swap не доехал).
deploy_emergency_start() {
  code=$?
  echo "(!) Деплой оборван (код $code) — аварийное восстановление"
  if [ ! -d .next ] && [ -d .next.old ]; then mv .next.old .next 2>/dev/null || true; fi
  systemctl start aletheia 2>/dev/null || true
  systemctl start aletheia-jobs 2>/dev/null || true
  systemctl start aletheia-telegram-poll 2>/dev/null || true
  exit "$code"
}
trap deploy_emergency_start ERR

if [ ! -d .next.incoming ]; then echo "Ошибка: нет .next.incoming (rsync .next не доехал)"; exit 1; fi

# --- Решения, что делать (ошибка ВСЕГДА в сторону безопасности: делать) ---
# npm ci нужен только при смене зависимостей или отсутствии node_modules.
NEED_CI=1
if [ -d node_modules ] && [ -f .deploy-lock-hash ] && sha256sum -c --status .deploy-lock-hash 2>/dev/null; then
  NEED_CI=0
fi
# migrate нужен только если есть неприменённые миграции. Любое сомнение → мигрируем.
NEED_MIGRATE=1
if npx prisma migrate status 2>/dev/null | grep -qiE "up to date|database schema is up to date"; then
  NEED_MIGRATE=0
fi

if [ "${RESET_AND_SEED:-0}" = "1" ]; then
  echo "RESET_AND_SEED=1 — полный сброс (данные БД удаляются)"
  systemctl stop aletheia aletheia-jobs aletheia-telegram-poll 2>/dev/null || true
  fuser -k 3000/tcp 2>/dev/null || true
  rm -rf node_modules; npm ci
  npx prisma migrate reset --force
  sha256sum package-lock.json > .deploy-lock-hash
  npx prisma generate
  rm -rf .next.old; [ -d .next ] && mv .next .next.old; mv .next.incoming .next
else
  # Тяжёлое БЕЗ простоя: если npm ci НЕ нужен — регенерируем клиент Prisma заранее
  # (безопасно при работающем инстансе: он держит старый клиент в памяти).
  if [ "$NEED_CI" = "0" ]; then npx prisma generate; fi

  echo "  → окно простоя: NEED_CI=$NEED_CI NEED_MIGRATE=$NEED_MIGRATE"
  # === ОКНО ПРОСТОЯ === (минимально: swap .next + рестарт; +npm ci/migrate лишь при нужде)
  # Воркеры и приложение держат SQLite → для migrate их надо остановить.
  STOPPED=""
  SVCS="aletheia"
  [ "$NEED_MIGRATE" = "1" ] && SVCS="aletheia aletheia-jobs aletheia-telegram-poll"
  for svc in $SVCS; do
    if systemctl is-active --quiet "$svc" 2>/dev/null; then
      systemctl stop "$svc" && STOPPED="$STOPPED $svc"
    fi
  done
  fuser -k 3000/tcp 2>/dev/null || true

  if [ "$NEED_CI" = "1" ]; then
    rm -rf node_modules; npm ci --omit=dev
    sha256sum package-lock.json > .deploy-lock-hash
    npx prisma generate
  fi
  if [ "$NEED_MIGRATE" = "1" ]; then
    npx prisma migrate deploy
    npx prisma generate
  fi

  # Атомарная подмена .next (быстро — переименование на том же ФС)
  rm -rf .next.old; [ -d .next ] && mv .next .next.old; mv .next.incoming .next
fi

# nginx cache (не влияет на веб-даунтайм)
CACHE_CLEARED=0
if [ -d /var/cache/nginx ] && [ -n "$(ls -A /var/cache/nginx 2>/dev/null)" ]; then
  sudo sh -c 'rm -rf /var/cache/nginx/*' || true
  CACHE_CLEARED=1
fi
if command -v nginx >/dev/null 2>&1 && sudo nginx -t 2>/dev/null; then
  if [ "$CACHE_CLEARED" = "1" ]; then sudo systemctl restart nginx || sudo nginx -s reload || true
  else sudo nginx -s reload || true; fi
fi

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete aletheia 2>/dev/null || true; pm2 delete avaterra 2>/dev/null || true; pm2 save 2>/dev/null || true
fi
if ! systemctl list-unit-files 2>/dev/null | grep -q '^aletheia.service'; then
  if [ -f scripts/systemd/aletheia.service.example ]; then
    cp scripts/systemd/aletheia.service.example /etc/systemd/system/aletheia.service
    systemctl daemon-reload; systemctl enable aletheia.service
  else echo "Ошибка: нет aletheia.service"; exit 1; fi
fi

# Старт приложения — конец окна простоя
fuser -k 3000/tcp 2>/dev/null || true
sudo systemctl restart aletheia.service
sudo systemctl is-active aletheia.service
trap - ERR
rm -f /run/aletheia-deploy.active
rm -rf .next.old

# Воркеры: переустановка юнитов + рестарт (не влияет на веб-даунтайм)
echo "=== Воркеры (poll, jobs) ==="
cp scripts/aletheia-telegram-poll.service /etc/systemd/system/aletheia-telegram-poll.service
cp scripts/aletheia-jobs.service /etc/systemd/system/aletheia-jobs.service
systemctl daemon-reload
systemctl enable aletheia-telegram-poll.service aletheia-jobs.service
npx tsx scripts/telegram-delete-webhook.ts 2>&1 | tail -3 || true
rm -f /etc/cron.d/aletheia-telegram-poll 2>/dev/null || true
systemctl restart aletheia-telegram-poll.service aletheia-jobs.service
systemctl is-active aletheia-telegram-poll.service aletheia-jobs.service
REMOTE

echo ""
echo "=== Готово. Проверьте: curl -sI https://avaterra.pro/ ==="
