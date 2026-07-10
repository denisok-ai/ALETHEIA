#!/bin/bash
# Безопасность VPS avaterra.pro — бэкап, ufw, sshd (порт 22 + ключи), nginx, права файлов.
# Запуск на сервере: sudo bash scripts/security-hardening-prod.sh
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/security-$(date +%Y%m%d-%H%M)}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/aletheia}"

echo "=== Security hardening ==="
echo "PROD_ROOT=$PROD_ROOT"
echo "BACKUP_DIR=$BACKUP_DIR"

mkdir -p "$BACKUP_DIR"

echo "=== Backup ==="
[ -f "$PROD_ROOT/.env" ] && cp -a "$PROD_ROOT/.env" "$BACKUP_DIR/.env.bak"
[ -f "$PROD_ROOT/prisma/dev.db" ] && cp -a "$PROD_ROOT/prisma/dev.db" "$BACKUP_DIR/dev.db.bak"
[ -f "$NGINX_SITE" ] && cp -a "$NGINX_SITE" "$BACKUP_DIR/nginx-aletheia.bak"
[ -f /etc/ssh/sshd_config ] && cp -a /etc/ssh/sshd_config "$BACKUP_DIR/sshd_config.bak"
[ -f /etc/fail2ban/jail.local ] && cp -a /etc/fail2ban/jail.local "$BACKUP_DIR/jail.local.bak"
ls -lah "$BACKUP_DIR"

echo "=== File permissions ==="
if [ -f "$PROD_ROOT/.env" ]; then
  chmod 600 "$PROD_ROOT/.env"
  chown root:root "$PROD_ROOT/.env" 2>/dev/null || true
fi
if [ -f "$PROD_ROOT/prisma/dev.db" ]; then
  chmod 600 "$PROD_ROOT/prisma/dev.db"
  chown root:root "$PROD_ROOT/prisma/dev.db" 2>/dev/null || true
fi

echo "=== ufw (SSH 22, HTTP 80/443, Mailcow 25/587/993) ==="
if command -v ufw >/dev/null 2>&1; then
  ufw --force default deny incoming
  ufw --force default allow outgoing
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
  ufw allow 25/tcp comment 'SMTP Mailcow'
  ufw allow 587/tcp comment 'Submission Mailcow'
  ufw allow 993/tcp comment 'IMAPS Mailcow'
  ufw --force enable
  ufw status verbose
else
  echo "ufw not installed — skipping"
fi

echo "=== sshd hardening (keep port 22 + pubkey) ==="
SSHD_DROPIN=/etc/ssh/sshd_config.d/99-avaterra-hardening.conf
mkdir -p /etc/ssh/sshd_config.d
cat > "$SSHD_DROPIN" << 'SSHDEOF'
# AVATERRA security hardening — SSH keys on port 22 only
Port 22
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 5
X11Forwarding no
SSHDEOF
# cloud-init часто ставит PasswordAuthentication yes первым — перебиваем
CLOUD=/etc/ssh/sshd_config.d/50-cloud-init.conf
if [ -f "$CLOUD" ]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$CLOUD"
fi
# shellcheck source=scripts/ssh-safety-guard.sh
source "$PROD_ROOT/scripts/ssh-safety-guard.sh"
assert_sshd_safe_before_reload
systemctl reload ssh 2>/dev/null || systemctl reload sshd
echo "sshd drop-in installed: $SSHD_DROPIN"

echo "=== nginx sync from repo example (if present) ==="
if [ -f "$PROD_ROOT/scripts/nginx-aletheia.conf" ]; then
  if [ -f "$NGINX_SITE" ]; then
    # Merge: only patch if HSTS missing
    if ! grep -q Strict-Transport-Security "$NGINX_SITE"; then
      sed -i '/ssl_dhparam/a \    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' "$NGINX_SITE" || true
    fi
    if grep -q 'client_max_body_size 512m' "$NGINX_SITE"; then
      sed -i 's/client_max_body_size 512m/client_max_body_size 100m/' "$NGINX_SITE"
    fi
  fi
  nginx -t
  systemctl reload nginx
  echo "nginx reloaded OK"
else
  echo "nginx example not in $PROD_ROOT — skip nginx patch"
fi

echo "=== fail2ban status ==="
if systemctl is-active fail2ban >/dev/null 2>&1; then
  fail2ban-client status || true
else
  echo "fail2ban not active"
fi

echo "=== Health check ==="
sleep 2
curl -sf "http://127.0.0.1:3000/api/health" | head -c 400 || echo "WARN: local health failed"
curl -sf "https://avaterra.pro/api/health" | head -c 400 || echo "WARN: external health failed"

echo "=== Done. Backup: $BACKUP_DIR ==="
