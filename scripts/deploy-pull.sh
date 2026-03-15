#!/bin/bash
# Выгрузка с гита на сервере: pull → install → migrate → build → restart.
# Запускать на сервере: bash scripts/deploy-pull.sh
# Путь проекта по умолчанию: /opt/ALETHEIA (переопределить через DEPLOY_ROOT)

set -e

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
PM2_NAME="${PM2_NAME:-aletheia}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$DEPLOY_ROOT"
echo "=== Выгрузка с Git: $DEPLOY_ROOT (ветка: $GIT_BRANCH) ==="

echo ""
echo "1. Git pull..."
git fetch origin
git pull origin "$GIT_BRANCH"
echo "   OK"

echo ""
echo "2. npm install..."
npm ci 2>/dev/null || npm install
echo "   OK"

echo ""
echo "3. Prisma..."
npx prisma generate
npx prisma migrate deploy 2>/dev/null || echo "   (миграции не требуются)"
echo "   OK"

echo ""
echo "4. Build..."
npm run build:server 2>/dev/null || npm run build
echo "   OK"

echo ""
echo "5. PM2 restart..."
pm2 restart "$PM2_NAME" 2>/dev/null || {
  echo "   PM2 не найден или процесс $PM2_NAME отсутствует."
  echo "   Запустите вручную: pm2 restart $PM2_NAME"
  echo "   Или: npm run start"
}
echo "   OK"

echo ""
echo "=== Готово. Код обновлён и приложение перезапущено. ==="
