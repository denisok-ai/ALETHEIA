#!/bin/bash
# Патч nginx на проде: auth_request для /uploads/scorm/ (без изменений SSH).
set -euo pipefail

NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/aletheia}"
PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
BACKUP="${BACKUP:-/root/backups/nginx-scorm-auth-$(date +%Y%m%d-%H%M)}"

mkdir -p "$BACKUP"
cp -a "$NGINX_SITE" "$BACKUP/aletheia.bak"

if grep -q 'internal/scorm-auth-check' "$NGINX_SITE"; then
  echo "SCORM auth_request already configured"
else
  python3 << 'PY'
from pathlib import Path
import re

site = Path("/etc/nginx/sites-available/aletheia")
text = site.read_text()
block = """
    # --- SCORM: только для авторизованных (nginx auth_request → Next.js) ---
    location = /internal/scorm-auth-check {
        internal;
        proxy_pass http://127.0.0.1:3000/api/portal/scorm/access-check;
        proxy_set_header X-Original-URI $request_uri;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header Cookie $http_cookie;
        proxy_set_header Host $host;
    }

    location /uploads/scorm/ {
        auth_request /internal/scorm-auth-check;
        alias /opt/ALETHEIA/public/uploads/scorm/;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Cache-Control $scorm_cache_control always;
        access_log off;
    }
"""
pat = re.compile(
    r"    # --- SCORM:.*?\n    location /uploads/scorm/ \{.*?\n    \}\n",
    re.S,
)
if not pat.search(text):
    raise SystemExit("SCORM location block not found in nginx site")
text = pat.sub(block + "\n", text, count=1)
site.write_text(text)
print("nginx site patched")
PY
fi

nginx -t
systemctl reload nginx
echo "nginx reloaded OK"

echo "=== Smoke: anonymous SCORM should be denied ==="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://avaterra.pro/uploads/scorm/" || echo "000")
echo "GET /uploads/scorm/ without session: HTTP $code (expect 401/403/404)"

curl -sf --max-time 10 https://avaterra.pro/api/health
echo
echo "Backup: $BACKUP"
