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

# Мониторинг доступности PayKeeper — каждые 5 мин.
# Сделан после инцидента 16.07.2026 (PayKeeper молчал ~7 минут, клиенты не могли
# оплатить, узнали от клиентов), но в этот установщик внесён не был — а он
# перезаписывает файл целиком, поэтому запись терялась при каждом запуске.
# Обнаружено 19.07.2026: пробник не работал с 17.07.
*/5 * * * * root /opt/ALETHEIA/scripts/cron-http-call.sh paykeeper-health

# Сверка «оплачено, но доступа нет» — каждые 10 мин.
# Страховочная сетка платёжного контура: ловит расхождение независимо от
# причины и не зависит от того, повторит ли PayKeeper доставку вебхука.
# Интервал выбран так, чтобы клиент ждал доступ минуты, а не часы.
*/10 * * * * root /opt/ALETHEIA/scripts/cron-http-call.sh reconcile-enrollments

# Сторож фоновых задач — каждые 30 мин.
# Сообщает, если задача перестала ВЫПОЛНЯТЬСЯ вообще (пропал файл cron,
# рестарт-луп демона). Живёт вне приложения: механизм внутри не может
# сообщить о собственной смерти.
*/30 * * * * root /opt/ALETHEIA/scripts/cron-heartbeat-watchdog.sh
CRONEOF

chmod 644 /etc/cron.d/aletheia-http-cron

echo "Installed /etc/cron.d/aletheia-http-cron"
echo "=== Manual test (all endpoints) ==="
for ep in mailings-send inmail-sync installment-payments reconcile-enrollments paykeeper-health; do
  if "$CALL" "$ep"; then
    echo "$ep: OK"
  else
    echo "$ep: FAIL (see /var/log/aletheia-cron-${ep}.log)"
    exit 1
  fi
done
echo "=== Done ==="
