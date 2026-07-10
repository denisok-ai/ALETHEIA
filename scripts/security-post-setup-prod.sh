#!/bin/bash
# Дополнительные шаги безопасности после hardening: ufw 5173, cron, nginx upload location.
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"

echo "=== Close ufw 5173 if open and unused ==="
if command -v ufw >/dev/null 2>&1; then
  # Удаляем по номеру (ufw status numbered) — с конца, чтобы индексы не сбивались
  for _ in 1 2 3 4; do
    num=$(ufw status numbered 2>/dev/null | grep -E '5173' | tail -1 | sed -n 's/^\[[[:space:]]*\([0-9]*\)\].*/\1/p')
    [ -n "$num" ] || break
    yes | ufw delete "$num" 2>/dev/null || ufw --force delete "$num" 2>/dev/null || break
  done
  ufw status | head -20
fi

echo "=== Install HTTP cron jobs ==="
if [ -f "$PROD_ROOT/scripts/install-aletheia-http-cron.sh" ]; then
  bash "$PROD_ROOT/scripts/install-aletheia-http-cron.sh"
else
  echo "WARN: install-aletheia-http-cron.sh not found"
fi

echo "=== nginx: ensure upload location blocks exist ==="
NGINX_SITE=/etc/nginx/sites-available/aletheia
if [ -f "$NGINX_SITE" ] && ! grep -q 'portal/admin/(courses/upload' "$NGINX_SITE"; then
  if [ -f "$PROD_ROOT/scripts/nginx-aletheia.conf" ]; then
    # Patch: copy upload block from repo example between telegram webhook and location /
    python3 << 'PY' || echo "nginx patch skipped"
import re
from pathlib import Path
repo = Path("/opt/ALETHEIA/scripts/nginx-aletheia.conf").read_text()
site_path = Path("/etc/nginx/sites-available/aletheia")
site = site_path.read_text()
block_m = re.search(
    r"    # --- Загрузки админки.*?# --- Динамика: портал",
    repo,
    re.S,
)
if not block_m:
    raise SystemExit("block not in repo example")
block = block_m.group(0).replace("# --- Динамика: портал", "").rstrip() + "\n\n"
if "portal/admin/(courses/upload" in site:
    raise SystemExit("already patched")
marker = "    # --- Динамика: портал"
if marker not in site:
    raise SystemExit("marker missing")
site = site.replace(marker, block + marker, 1)
site_path.write_text(site)
print("nginx upload locations patched")
PY
    nginx -t && systemctl reload nginx
  fi
fi

echo "=== Encrypt plaintext backup .env copies (optional) ==="
BACKUP_ROOT=/root/backups
if command -v gpg >/dev/null 2>&1; then
  find "$BACKUP_ROOT" -name '.env.bak' -o -name '.env.before-cron*' 2>/dev/null | while read -r f; do
    [ -f "$f" ] || continue
    gpg --batch --yes --symmetric --cipher-algo AES256 -o "${f}.gpg" "$f" 2>/dev/null && shred -u "$f" 2>/dev/null || rm -f "$f"
    echo "encrypted: $f"
  done
else
  echo "gpg not installed — skip backup encryption"
fi

echo "=== Final checks ==="
curl -sf --max-time 15 http://127.0.0.1:3000/api/health | head -c 200
echo
curl -sf --max-time 15 https://avaterra.pro/api/health | head -c 200
echo
systemctl is-active aletheia aletheia-telegram-poll aletheia-jobs
ls -la /etc/cron.d/aletheia-http-cron 2>/dev/null || true
