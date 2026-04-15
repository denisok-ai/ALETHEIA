#!/usr/bin/env bash
# Расширенная диагностика продуктивного VPS (только чтение, без изменений на диске).
# Запуск на сервере из каталога приложения или с любого cwd:
#   bash /opt/ALETHEIA/scripts/prod-diagnostics.sh
# Сохранить отчёт:
#   bash /opt/ALETHEIA/scripts/prod-diagnostics.sh | tee ~/prod-audit-$(date +%F-%H%M).txt
#
# Назначение: выявить второй клон приложения, другой DATABASE_URL, дубликаты процессов на порту.

set -u

CANON="${PROD_ROOT:-/opt/ALETHEIA}"

sec() { printf '\n\n======== %s ========\n' "$1"; }

mask_url() {
  local s="$1"
  if [[ "$s" == postgresql:* ]] || [[ "$s" == postgres:* ]] || [[ "$s" == mysql:* ]]; then
    echo "$s" | sed -E 's|(postgresql?://[^:]+:)[^@]+(@)|\1***\2|'
  elif [[ "$s" == file:* ]]; then
    echo "$s"
  else
    echo "${s:0:60}..."
  fi
}

sec "Время и хост"
date -u 2>/dev/null || date
hostnamectl 2>/dev/null || true
uname -a

sec "Ресурсы"
df -h 2>/dev/null || true
free -h 2>/dev/null || true
uptime 2>/dev/null || true

sec "Канонический каталог ($CANON)"
if [[ -d "$CANON" ]]; then
  ls -la "$CANON" | head -40
else
  echo "Каталог $CANON не найден."
fi

sec "/var/www (вторые клоны)"
if [[ -d /var/www ]]; then
  ls -la /var/www 2>/dev/null | head -40
else
  echo "Нет /var/www"
fi

sec "Поиск package.json (глубина ≤4 под /opt и /var/www)"
find /opt /var/www -maxdepth 4 -name package.json 2>/dev/null | head -50 || true

sec "Порты 80, 443, 3000"
ss -tlnp 2>/dev/null | grep -E ':80 |:443|:3000' || ss -tlnp 2>/dev/null | head -30 || true

sec "Процессы node / next"
ps aux 2>/dev/null | grep -E '[n]ode|[n]ext' || echo "(нет совпадений)"

sec "Systemd: сервисы aletheia / avaterra / next"
systemctl list-units --type=service --state=running 2>/dev/null | grep -iE 'aletheia|avaterra|next' || echo "(нет совпадений в списке running)"

sec "PM2 (если установлен)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null || true
else
  echo "pm2 не в PATH"
fi

sec "Unit aletheia.service (если есть)"
systemctl cat aletheia 2>/dev/null || systemctl cat aletheia.service 2>/dev/null || echo "(unit не найден)"

sec "systemctl show aletheia (WorkingDirectory, Environment)"
systemctl show aletheia -p WorkingDirectory -p Environment -p EnvironmentFiles 2>/dev/null \
  || systemctl show aletheia.service -p WorkingDirectory -p Environment -p EnvironmentFiles 2>/dev/null \
  || true

sec "journalctl -u aletheia (последние 40 строк)"
journalctl -u aletheia -n 40 --no-pager 2>/dev/null || journalctl -u aletheia.service -n 40 --no-pager 2>/dev/null || true

sec "Nginx: nginx -t"
nginx -t 2>&1 || true

sec "Nginx: sites-enabled"
ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true

sec "Nginx: proxy_pass в sites-enabled"
grep -R "proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null || true

sec "DATABASE_URL из .env (префиксы, без полного секрета)"
for f in "$CANON/.env" /var/www/.env /var/www/*/.env /var/www/*/*/.env; do
  if [[ -f "$f" ]]; then
    line="$(grep -E '^[[:space:]]*DATABASE_URL=' "$f" 2>/dev/null | head -1 || true)"
    if [[ -n "$line" ]]; then
      val="${line#*=}"
      val="${val#\"}"; val="${val%\"}"
      val="${val#\'}"; val="${val%\'}"
      echo "$f → $(mask_url "$val")"
    fi
  fi
done 2>/dev/null || true

sec "Файлы *.db под $CANON и /var/www (первые 40)"
find "$CANON" /var/www -name '*.db' 2>/dev/null | head -40 || true

sec "SQLite Service: сравнение dev.db (если sqlite3 есть)"
if command -v sqlite3 >/dev/null 2>&1; then
  for db in "$CANON/prisma/dev.db" /var/www/*/prisma/dev.db /var/www/*/*/prisma/dev.db; do
    if [[ -f "$db" ]]; then
      echo "--- $db ---"
      sqlite3 "$db" "SELECT COUNT(*) AS n, printf('%.200s', GROUP_CONCAT(slug)) FROM Service;" 2>/dev/null || echo "(ошибка чтения)"
    fi
  done 2>/dev/null || true
else
  echo "sqlite3 не установлен: apt install sqlite3 — для проверки содержимого Service"
fi

sec "curl localhost (API health)"
curl -sS -m 5 "http://127.0.0.1:3000/api/health" 2>/dev/null | head -c 600 || echo "(недоступно или другой порт — см. PORT в .env)"

sec "curl внешний shop products (обрезка)"
curl -sS -m 10 "https://avaterra.pro/api/shop/products" 2>/dev/null | head -c 800 || echo "(ошибка curl)"

sec "Git в $CANON"
if [[ -d "$CANON/.git" ]]; then
  (cd "$CANON" && git rev-parse --show-toplevel && git log -1 --oneline && git status -sb) 2>/dev/null || true
else
  echo "Нет git в $CANON"
fi

sec "Конец отчёта"
echo "Подсказка: если число строк Service в sqlite отличается от ответа /api/shop/products — приложение и скрипт смотрят на разные БД или разные каталоги."
