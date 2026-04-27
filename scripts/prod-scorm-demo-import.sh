#!/usr/bin/env bash
# Импорт демо SCORM «Пробный 1» (course-demo-muscle-testing) на продакшен VPS.
# См. docs/Production-Server.md — каталог приложения по умолчанию /opt/ALETHEIA
#
# 1) Скопируйте ZIP на сервер, например:
#    scp docs/scorm/навыки_мышечного_тестирования_demo_scorm2004_2.zip root@95.181.224.70:/opt/ALETHEIA/docs/scorm/
# 2) На сервере:
#    cd /opt/ALETHEIA && sudo bash scripts/prod-scorm-demo-import.sh
#    или с путём к архиву:
#    sudo bash scripts/prod-scorm-demo-import.sh /opt/ALETHEIA/docs/scorm/навыки_мышечного_тестирования_demo_scorm2004_2.zip
#
# 3) Запись слушателя на курс (email — реальный пользователь на проде):
#    cd /opt/ALETHEIA && export ENROLL_EMAIL="user@example.com" && npx tsx scripts/enroll-demo-scorm-student.ts
#
# Либо в админке: Портал → курсы → «Пробный 1» → записать пользователя.

set -euo pipefail
ROOT="${DEPLOY_ROOT:-/opt/ALETHEIA}"
cd "$ROOT"

ZIP="${1:-$ROOT/docs/scorm/навыки_мышечного_тестирования_demo_scorm2004_2.zip}"
if [[ ! -f "$ZIP" ]]; then
  echo "Файл не найден: $ZIP"
  echo "Положите SCORM ZIP в docs/scorm/ на сервере или передайте полный путь первым аргументом."
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-file:${ROOT}/prisma/dev.db}"
echo "DATABASE_URL=$DATABASE_URL"
echo "ZIP=$ZIP"

npx prisma migrate deploy
npx tsx scripts/import-demo-scorm.ts "$ZIP"
echo "Готово. Добавьте запись пользователю (ENROLL_EMAIL + enroll-demo-scorm-student.ts или админка)."
