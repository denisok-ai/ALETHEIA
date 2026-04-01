#!/usr/bin/env bash
# Показать тип БД по DATABASE_URL (без полного URL с паролем) и наличие файла SQLite.
# Запуск на сервере: bash scripts/check-database-url.sh
# Из каталога приложения: cd /opt/ALETHEIA && bash scripts/check-database-url.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Нет файла: $ENV_FILE"
  exit 1
fi

# Значение DATABASE_URL (первая строка, без комментариев)
raw="$(grep -E '^[[:space:]]*DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^[[:space:]]*DATABASE_URL=//')"
# Снять обрамляющие кавычки
val="${raw#\"}"
val="${val%\"}"
val="${val#\'}"
val="${val%\'}"

echo "=== prisma/schema.prisma (provider в репозитории) ==="
grep -A2 '^datasource db' "${ROOT}/prisma/schema.prisma" | head -5

echo ""
echo "=== DATABASE_URL на этом сервере (только префикс / путь, без пароля) ==="
case "$val" in
  file:*)
    path_part="${val#file:}"
    # относительный путь от prisma/
    echo "Тип: SQLite (file:)"
    echo "Путь в URL: $path_part"
    if [[ "$path_part" != /* ]]; then
      abs="${ROOT}/prisma/${path_part#./}"
    else
      abs="$path_part"
    fi
    echo "Ожидаемый абсолютный путь: $abs"
    if [[ -f "$abs" ]]; then
      echo "Файл БД: есть ($(stat -c%s "$abs" 2>/dev/null || stat -f%z "$abs" 2>/dev/null) bytes)"
    else
      echo "Файл БД: НЕ НАЙДЕН по этому пути"
    fi
    ;;
  postgresql:*|postgres:*)
    echo "Тип: PostgreSQL"
    # user@host:port/db без пароля
    safe="$(echo "$val" | sed -E 's|(postgresql?://[^:]+:)[^@]+(@)|\1***\2|')"
    echo "URL (пароль скрыт): $safe"
    ;;
  mysql:*)
    echo "Тип: MySQL / MariaDB"
    safe="$(echo "$val" | sed -E 's|(mysql://[^:]+:)[^@]+(@)|\1***\2|')"
    echo "URL (пароль скрыт): $safe"
    ;;
  *)
    echo "Тип: неизвестный префикс"
    echo "Начало строки: ${val:0:48}..."
    ;;
esac

echo ""
echo "=== Процесс Node (если есть) — рабочий каталог должен совпадать с приложением ==="
if command -v pgrep >/dev/null 2>&1; then
  pid="$(pgrep -f 'node.*next' | head -1 || true)"
  if [[ -n "${pid:-}" ]]; then
    echo "PID $pid cwd: $(readlink -f "/proc/$pid/cwd" 2>/dev/null || echo '?')"
  else
    echo "(процесс next/node не найден через pgrep)"
  fi
fi
