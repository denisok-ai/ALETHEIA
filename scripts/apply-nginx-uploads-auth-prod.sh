#!/bin/bash
# Патч nginx на проде: auth_request для приватной статики /uploads/media/ и
# /uploads/verifications/ (сейчас отдаются публично напрямую с диска).
# Требует задеплоенного приложения с маршрутом /api/portal/uploads/access-check.
# Запуск на сервере: bash scripts/apply-nginx-uploads-auth-prod.sh
set -euo pipefail

NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/aletheia}"
BACKUP="${BACKUP:-/root/backups/nginx-uploads-auth-$(date +%Y%m%d-%H%M)}"

mkdir -p "$BACKUP"
cp -a "$NGINX_SITE" "$BACKUP/aletheia.bak"

if grep -q 'internal/uploads-auth-check' "$NGINX_SITE"; then
  echo "uploads auth_request already configured"
else
  python3 << 'PY'
from pathlib import Path
import re

site = Path("/etc/nginx/sites-available/aletheia")
text = site.read_text()
block = """
    # --- Приватная статика: медиатека и видео-верификации — только с сессией ---
    location = /internal/uploads-auth-check {
        internal;
        proxy_pass http://127.0.0.1:3000/api/portal/uploads/access-check;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-Original-URI $request_uri;
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
    }

    location /uploads/media/ {
        auth_request /internal/uploads-auth-check;
        alias /opt/ALETHEIA/public/uploads/media/;
        add_header Cache-Control $uploads_cache_control always;
        access_log off;
    }

    location /uploads/verifications/ {
        auth_request /internal/uploads-auth-check;
        alias /opt/ALETHEIA/public/uploads/verifications/;
        add_header Cache-Control "private, no-store" always;
        access_log off;
    }
"""
# Вставляем перед общим "location /uploads/" (более специфичные prefix-location'ы приоритетнее,
# но держим их рядом для читаемости)
marker = re.compile(r"(\n    location /uploads/ \{)")
if not marker.search(text):
    raise SystemExit("generic /uploads/ location not found in nginx site")
text = marker.sub(block + r"\1", text, count=1)
site.write_text(text)
print("nginx site patched")
PY
fi

nginx -t
systemctl reload nginx
echo "nginx reloaded OK"

echo "=== Smoke: anonymous access should be denied ==="
for p in /uploads/media/ /uploads/verifications/; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://avaterra.pro${p}" || echo "000")
  echo "GET ${p} without session: HTTP $code (expect 401/403/404)"
done

curl -sf --max-time 10 https://avaterra.pro/api/health
echo
echo "Backup: $BACKUP"
