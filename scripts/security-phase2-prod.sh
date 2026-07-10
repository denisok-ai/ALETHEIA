#!/bin/bash
# Фаза 2 hardening на VPS: localhost-only Next.js, sshd без паролей, Docker DOCKER-USER.
# SSH: порт 22 + ключи сохраняются. Запуск: sudo bash scripts/security-phase2-prod.sh
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/security-phase2-$(date +%Y%m%d-%H%M)}"
UNIT=/etc/systemd/system/aletheia.service

mkdir -p "$BACKUP_DIR"
[ -f "$UNIT" ] && cp -a "$UNIT" "$BACKUP_DIR/"
[ -f /etc/ssh/sshd_config.d/50-cloud-init.conf ] && cp -a /etc/ssh/sshd_config.d/50-cloud-init.conf "$BACKUP_DIR/"

echo "=== 1. sshd: отключить password auth (ключи на порту 22) ==="
CLOUD=/etc/ssh/sshd_config.d/50-cloud-init.conf
if [ -f "$CLOUD" ]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$CLOUD"
  sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' "$CLOUD" 2>/dev/null || true
fi
# Drop-in на случай отсутствия cloud-init
cat > /etc/ssh/sshd_config.d/99-avaterra-hardening.conf << 'SSHDEOF'
Port 22
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 5
X11Forwarding no
SSHDEOF
# shellcheck source=scripts/ssh-safety-guard.sh
source "$PROD_ROOT/scripts/ssh-safety-guard.sh"
assert_sshd_safe_before_reload
systemctl reload ssh 2>/dev/null || systemctl reload sshd

echo "=== 2. aletheia.service: bind 127.0.0.1 + crash-loop limit ==="
if [ -f "$UNIT" ]; then
  if ! grep -q 'StartLimitIntervalSec' "$UNIT"; then
    sed -i '/^RestartSec=/a StartLimitIntervalSec=300\nStartLimitBurst=5' "$UNIT"
  fi
  if grep -q '^Environment=HOSTNAME=' "$UNIT"; then
    sed -i 's/^Environment=HOSTNAME=.*/Environment=HOSTNAME=127.0.0.1/' "$UNIT"
  else
    sed -i '/^Environment=NODE_OPTIONS=/a Environment=HOSTNAME=127.0.0.1' "$UNIT"
  fi
  systemctl daemon-reload
  systemctl restart aletheia
  sleep 5
  echo "aletheia: $(systemctl is-active aletheia)"
fi

echo "=== 3. Проверка bind :3000 ==="
ss -tlnp | grep 3000 || echo "WARN: port 3000 not listening"

echo "=== 4. Docker DOCKER-USER: блок внешнего доступа к dev-портам ==="
# Порты infrastructure (qdrant, dozzle, minio, ai) — только localhost снаружи VPS
DOCKER_PORTS=(6333 6334 8888 8001 8002 9000 9001)
if command -v iptables >/dev/null 2>&1; then
  for port in "${DOCKER_PORTS[@]}"; do
    if ss -tlnp | grep -q ":${port} "; then
      iptables -C DOCKER-USER -p tcp --dport "$port" ! -s 127.0.0.1 -j DROP 2>/dev/null \
        || iptables -I DOCKER-USER -p tcp --dport "$port" ! -s 127.0.0.1 -j DROP
      echo "DOCKER-USER drop external tcp/$port"
    fi
  done
  # Правила DOCKER-USER — не ставим iptables-persistent (конфликтует с ufw на Ubuntu).
  # Для сохранения после reboot: scripts/restore-ufw-prod.sh пишет в /etc/ufw/after.rules
else
  echo "iptables not found — skip DOCKER-USER"
fi

echo "=== 5. Health ==="
curl -sf --max-time 15 http://127.0.0.1:3000/api/health | head -c 200 || echo "local health FAIL"
echo
curl -sf --max-time 15 https://avaterra.pro/api/health | head -c 200 || echo "external health FAIL"
echo
# Снаружи :3000 не должен отвечать (если bind OK)
EXT3000=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://95.181.224.70:3000/api/health 2>/dev/null || echo "000")
echo "external_direct_3000_http=$EXT3000 (expect 000 or timeout)"

echo "=== Done. Backup: $BACKUP_DIR ==="
