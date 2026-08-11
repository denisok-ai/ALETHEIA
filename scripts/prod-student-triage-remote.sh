#!/usr/bin/env bash
# Триаж «студент оплатил, но видит не тот курс/демо» — ТОЛЬКО ЧТЕНИЕ прод-БД.
# Запуск с локальной машины: bash scripts/prod-student-triage-remote.sh [строка-поиска]
# Строка-поиска — часть имени или email клиента; без неё показываются последние заказы.
#
# Что смотрит (см. docs и память student-access-triage):
#   Order → оплата и связка userId; Enrollment → какой courseId открыт;
#   Course → какой SCORM-пакет (title, scormPath); ScormProgress → что реально открывалось;
#   Service → на какой courseId указывает тариф заказа.

set -euo pipefail

HOST="${PROD_HOST:-root@95.181.224.70}"
DB="/opt/ALETHEIA/prisma/dev.db"
NEEDLE="${1:-}"

ssh "$HOST" NEEDLE="$NEEDLE" DB="$DB" 'bash -s' <<'REMOTE'
set -euo pipefail
q() { sqlite3 -readonly -header -column "$DB" "$1"; }

echo "======== Последние заказы ========"
q "SELECT orderNumber, clientName, clientEmail, status, amount, tariffId, substr(userId,1,10) AS userId, datetime(createdAt/1000,'unixepoch','+3 hours') AS createdMsk
   FROM 'Order' ORDER BY createdAt DESC LIMIT 12;"

if [ -n "$NEEDLE" ]; then
  echo
  echo "======== Заказы по «$NEEDLE» ========"
  q "SELECT id, orderNumber, clientName, clientEmail, status, amount, tariffId, userId, datetime(createdAt/1000,'unixepoch','+3 hours') AS createdMsk
     FROM 'Order' WHERE clientName LIKE '%$NEEDLE%' OR clientEmail LIKE '%$NEEDLE%' ORDER BY createdAt DESC LIMIT 10;"

  echo
  echo "======== Пользователи по «$NEEDLE» ========"
  q "SELECT u.id, u.email, u.displayName, datetime(u.createdAt/1000,'unixepoch','+3 hours') AS createdMsk
     FROM User u WHERE u.email LIKE '%$NEEDLE%'
        OR u.id IN (SELECT userId FROM 'Order' WHERE (clientName LIKE '%$NEEDLE%' OR clientEmail LIKE '%$NEEDLE%') AND userId IS NOT NULL)
     LIMIT 10;"

  echo
  echo "======== Зачисления этих пользователей ========"
  q "SELECT e.id AS enrollmentId, u.email, e.courseId, c.title AS courseTitle, e.accessClosed, e.completedAt, datetime(e.enrolledAt/1000,'unixepoch','+3 hours') AS enrolledMsk
     FROM Enrollment e JOIN User u ON u.id=e.userId LEFT JOIN Course c ON c.id=e.courseId
     WHERE u.email LIKE '%$NEEDLE%'
        OR u.id IN (SELECT userId FROM 'Order' WHERE (clientName LIKE '%$NEEDLE%' OR clientEmail LIKE '%$NEEDLE%') AND userId IS NOT NULL)
     ORDER BY e.enrolledAt DESC LIMIT 10;"

  echo
  echo "======== SCORM-прогресс этих пользователей ========"
  q "SELECT u.email, s.courseId, c.title AS courseTitle, s.lessonId, s.completionStatus, s.score, datetime(s.lastUpdated/1000,'unixepoch','+3 hours') AS updatedMsk
     FROM ScormProgress s JOIN User u ON u.id=s.userId LEFT JOIN Course c ON c.id=s.courseId
     WHERE u.email LIKE '%$NEEDLE%'
        OR u.id IN (SELECT userId FROM 'Order' WHERE (clientName LIKE '%$NEEDLE%' OR clientEmail LIKE '%$NEEDLE%') AND userId IS NOT NULL)
     ORDER BY s.lastUpdated DESC LIMIT 10;"
fi

echo
echo "======== Курсы (id, название, SCORM-путь) ========"
q "SELECT id, title, scormPath, courseFormat FROM Course;"

echo
echo "======== Тарифы → courseId ========"
q "SELECT id, name, slug, courseId, price, isActive FROM Service ORDER BY createdAt DESC LIMIT 20;"
REMOTE
