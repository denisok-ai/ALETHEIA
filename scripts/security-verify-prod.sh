#!/bin/bash
# Read-only аудит безопасности VPS (не меняет sshd/ufw). SSH: порт 22 + ключи.
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
PASS=0
WARN=0
FAIL=0

ok() { echo "[OK] $*"; PASS=$((PASS + 1)); }
warn() { echo "[WARN] $*"; WARN=$((WARN + 1)); }
fail() { echo "[FAIL] $*"; FAIL=$((FAIL + 1)); }

echo "=== AVATERRA security verify $(date -Iseconds) ==="

echo "--- SSH (read-only) ---"
SSHD_CFG=$(/usr/sbin/sshd -T -f /etc/ssh/sshd_config 2>/dev/null || true)
port=$(printf '%s\n' "$SSHD_CFG" | awk '/^port /{print $2; exit}')
pubkey=$(printf '%s\n' "$SSHD_CFG" | awk '/^pubkeyauthentication /{print $2; exit}')
passauth=$(printf '%s\n' "$SSHD_CFG" | awk '/^passwordauthentication /{print $2; exit}')
[ "$port" = "22" ] && ok "sshd port 22" || fail "sshd port=$port (expected 22)"
[ "$pubkey" = "yes" ] && ok "PubkeyAuthentication yes" || fail "PubkeyAuthentication=$pubkey"
[ "$passauth" = "no" ] && ok "PasswordAuthentication no" || warn "PasswordAuthentication=$passauth"

echo "--- Network ---"
ss -tlnp | grep -q '127.0.0.1:3000' && ok "Next.js on 127.0.0.1:3000" || fail "Next.js not bound to localhost"
ss -tlnp | grep -qE '0\.0\.0\.0:3000|\*:3000' && fail "Next.js exposed on 0.0.0.0:3000" || ok "port 3000 not public"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ok "ufw active"
  ufw status | grep -q '22/tcp' && ok "ufw allows 22" || fail "ufw missing 22"
  ufw status | grep -q '443/tcp' && ok "ufw allows 443" || warn "ufw missing 443"
  ufw status | grep -q '5173' && warn "ufw still allows 5173" || ok "ufw no 5173"
else
  warn "ufw not active"
fi

echo "--- App ---"
curl -sf --max-time 10 http://127.0.0.1:3000/api/health >/dev/null && ok "local health" || fail "local health"
curl -sf --max-time 10 https://avaterra.pro/api/health >/dev/null && ok "public health" || fail "public health"

scorm_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 https://avaterra.pro/uploads/scorm/ || echo "000")
[[ "$scorm_code" == "401" || "$scorm_code" == "403" ]] && ok "SCORM anon denied ($scorm_code)" || warn "SCORM anon HTTP $scorm_code"

grep -q 'internal/scorm-auth-check' /etc/nginx/sites-available/aletheia 2>/dev/null && ok "nginx SCORM auth_request" || warn "nginx SCORM auth missing"

echo "--- Cron ---"
[ -f /etc/cron.d/aletheia-http-cron ] && ok "HTTP cron installed" || warn "HTTP cron missing"
grep -q '^CRON_SECRET=' "$PROD_ROOT/.env" 2>/dev/null && ok "CRON_SECRET in .env" || fail "CRON_SECRET missing"

echo "--- Files ---"
[ -f "$PROD_ROOT/.env" ] && [ "$(stat -c '%a' "$PROD_ROOT/.env")" = "600" ] && ok ".env mode 600" || warn ".env permissions"
[ -f "$PROD_ROOT/prisma/dev.db" ] && [ "$(stat -c '%a' "$PROD_ROOT/prisma/dev.db")" = "600" ] && ok "dev.db mode 600" || warn "dev.db permissions"

echo "--- Services ---"
for s in aletheia aletheia-telegram-poll aletheia-jobs; do
  systemctl is-active --quiet "$s" && ok "$s active" || fail "$s not active"
done

echo "=== Summary: OK=$PASS WARN=$WARN FAIL=$FAIL ==="
[ "$FAIL" -eq 0 ]
