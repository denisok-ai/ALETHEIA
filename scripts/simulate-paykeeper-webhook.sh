#!/usr/bin/env bash
# Симуляция webhook PayKeeper: создаёт заказ через API и вызывает webhook с подписью.
# Использование: PAYKEEPER_SECRET=your_secret [BASE_URL=http://localhost:3000] ./scripts/simulate-paykeeper-webhook.sh [email] [serviceSlug]
# После запуска войдите под указанным email в портал → Мои курсы — курс должен появиться.

set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${1:-student1@test.local}"
SLUG="${2:-course-1}"

if [ -z "$PAYKEEPER_SECRET" ]; then
  echo "Задайте PAYKEEPER_SECRET (из .env или Настройки → Платежи)."
  exit 1
fi

echo "Создание заказа: $SLUG, $EMAIL..."
RES=$(curl -s -X POST "$BASE_URL/api/payment/create" \
  -H "Content-Type: application/json" \
  -d "{\"serviceSlug\":\"$SLUG\",\"email\":\"$EMAIL\",\"name\":\"Test\"}")

orderNumber=$(echo "$RES" | sed -n 's/.*"orderNumber":"\([^"]*\)".*/\1/p')
amount=$(echo "$RES" | sed -n 's/.*"amount":\([0-9]*\).*/\1/p')

if [ -z "$orderNumber" ]; then
  echo "Ошибка создания заказа: $RES"
  exit 1
fi

echo "Заказ: $orderNumber, сумма: $amount. Вызов webhook..."
KEY=$(echo -n "1|${amount}|${orderNumber}|${PAYKEEPER_SECRET}" | openssl md5 -binary | xxd -p -c 32)
curl -s -X POST "$BASE_URL/api/webhook/paykeeper" \
  -F "id=1" -F "sum=$amount" -F "orderid=$orderNumber" -F "key=$KEY"
echo ""
echo "Готово. Войдите как $EMAIL (пароль Test123! после seed) → Мои курсы."
