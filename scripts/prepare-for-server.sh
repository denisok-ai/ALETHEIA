#!/bin/bash
# Подготовка сборки для переноса на Git и запуска на сервере (в т.ч. в режиме отладки).
# Запуск: ./scripts/prepare-for-server.sh

set -e
cd "$(dirname "$0")/.."

echo "=== AVATERRA: подготовка к переносу на сервер ==="
echo ""

echo "1. Линт..."
npm run lint
echo "   OK"
echo ""

echo "2. Сборка (build)..."
npm run build
echo "   OK"
echo ""

echo "=== Сборка готова ==="
echo ""
echo "Дальнейшие шаги:"
echo ""
echo "  Перенос в Git:"
echo "    git status"
echo "    git add -A"
echo "    git commit -m \"ваше сообщение\""
echo "    git push origin main"
echo ""
echo "  На сервере (после git pull):"
echo "    cd /opt/ALETHEIA   # или ваш путь"
echo "    npm ci --omit=dev   # или npm install"
echo "    npx prisma generate"
echo "    npx prisma migrate deploy   # если есть миграции"
echo "    npm run build        # или npm run build:server при нехватке памяти"
echo ""
echo "  Запуск в обычном режиме:"
echo "    npm run start"
echo "    # или: pm2 start npm --name aletheia -- start"
echo ""
echo "  Запуск в режиме отладки (inspect):"
echo "    npm run start:debug"
echo "    # или: pm2 start npm --name aletheia-debug -- run start:debug"
echo "    # Подключение отладчика: Chrome DevTools -> Remote target (порт 9229)"
echo ""
