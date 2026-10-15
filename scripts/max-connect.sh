#!/usr/bin/env bash
# @file: max-connect.sh
# @description: Подключает канал школы в MAX к автопубликации: токен бота → настройки прода (зашифрован),
#   проверка токена, chat id канала из события bot_added, права бота, сеть «max» в планировщике.
#   Токен не печатается: идёт потоком файл → ssh → stdin scripts/max-connect.ts.
# @usage: bash scripts/max-connect.sh <файл-с-токеном> [--wait=10] [--delete-file]
#   После запуска добавьте бота администратором канала (право «Публиковать посты») — скрипт ждёт до --wait минут.
#   Без файла (bash scripts/max-connect.sh -) — только перепроверить канал и права с уже сохранённым токеном.
set -euo pipefail

TOKEN_FILE=${1:?файл с токеном или «-»}
shift
WAIT=--wait=10
DELETE=
for a in "$@"; do
  case "$a" in
    --wait=*) WAIT=$a ;;
    --delete-file) DELETE=1 ;;
    *) echo "Неизвестный аргумент: $a"; exit 1 ;;
  esac
done
AV=root@95.181.224.70

if [ "$TOKEN_FILE" = "-" ]; then
  ssh "$AV" "cd /opt/ALETHEIA && npx tsx --env-file=.env scripts/max-connect.ts $WAIT < /dev/null"
else
  [ -s "$TOKEN_FILE" ] || { echo "Файл пуст или не найден: $TOKEN_FILE"; exit 1; }
  tr -d ' \r\n' < "$TOKEN_FILE" | ssh "$AV" "cd /opt/ALETHEIA && npx tsx --env-file=.env scripts/max-connect.ts $WAIT"
fi

if [ -n "$DELETE" ] && [ "$TOKEN_FILE" != "-" ]; then
  shred -u "$TOKEN_FILE" 2>/dev/null || rm -f "$TOKEN_FILE"
  echo "Файл с токеном удалён: $TOKEN_FILE"
fi
