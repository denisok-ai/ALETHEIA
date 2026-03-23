#!/bin/bash
# Выгрузка с гита на сервере: pull → install → migrate → build → restart.
# Запускать на сервере: bash scripts/deploy-pull.sh
# Путь проекта по умолчанию: /opt/ALETHEIA (переопределить через DEPLOY_ROOT)
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
echo "6. Проверка ответа сайта..."
if command -v curl >/dev/null 2>&1; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 https://avaterra.pro/ 2>/dev/null || echo "000")
  echo "   https://avaterra.pro/ → HTTP $code"
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
