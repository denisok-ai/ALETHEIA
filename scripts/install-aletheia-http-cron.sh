#!/bin/bash
# Установка /etc/cron.d/aletheia-http-cron на VPS (рассылки, IMAP, рассрочка).
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
CALL="$PROD_ROOT/scripts/cron-http-call.sh"

if [ ! -f "$CALL" ]; then
  echo "Missing $CALL — deploy scripts first" >&2
  exit 1
fi
chmod +x "$CALL"

if ! grep -q '^CRON_SECRET=' "${PROD_ROOT}/.env" 2>/dev/null; then
  echo "CRON_SECRET not in ${PROD_ROOT}/.env — run setup-cron-secret-prod.sh first" >&2
  exit 1
fi

cat > /etc/cron.d/aletheia-http-cron << 'CRONEOF'
# AVATERRA HTTP cron (Bearer CRON_SECRET из /opt/ALETHEIA/.env)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Запланированные рассылки — каждые 5 мин
*/5 * * * * root /opt/ALETHEIA/scripts/cron-http-call.sh mailings-send

# Синхронизация IMAP (Входящие) — каждые 15 мин
*/15 * * * * root /opt/ALETHEIA/scripts/cron-http-call.sh inmail-sync

# Рассрочка: напоминания, автосписание, overdue — каждый час
0 * * * * root /opt/ALETHEIA/scripts/cron-http-call.sh installment-payments

# Сверка «оплачено, но доступа нет» — каждые 10 мин.
# Страховочная сетка платёжного контура: ловит расхождение независимо от
# причины и не зависит от того, повторит ли PayKeeper доставку вебхука.
# Интервал выбран так, чтобы клиент ждал доступ минуты, а не часы.
*/10 * * * * root /opt/ALETHEIA/scripts/cron-http-call.sh reconcile-enrollments
CRONEOF

chmod 644 /etc/cron.d/aletheia-http-cron

echo "Installed /etc/cron.d/aletheia-http-cron"
echo "=== Manual test (all endpoints) ==="
for ep in mailings-send inmail-sync installment-payments reconcile-enrollments; do
  if "$CALL" "$ep"; then
    echo "$ep: OK"
  else
    echo "$ep: FAIL (see /var/log/aletheia-cron-${ep}.log)"
    exit 1
  fi
done
echo "=== Done ==="
