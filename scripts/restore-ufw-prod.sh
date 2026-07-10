#!/bin/bash
# Восстановление ufw после конфликта с iptables-persistent. SSH: порт 22 + ключи.
# Запуск на VPS: sudo bash scripts/restore-ufw-prod.sh
set -euo pipefail

PROD_ROOT="${PROD_ROOT:-/opt/ALETHEIA}"

echo "=== Pre-check SSH (read-only) ==="
SSHD_CFG=$(sshd -T 2>/dev/null || true)
port=$(printf '%s\n' "$SSHD_CFG" | awk '/^port /{print $2; exit}')
pubkey=$(printf '%s\n' "$SSHD_CFG" | awk '/^pubkeyauthentication /{print $2; exit}')
echo "sshd port=$port pubkey=$pubkey"
[ "$port" = "22" ] || { echo "FATAL: port not 22, abort"; exit 1; }
[ "$pubkey" = "yes" ] || { echo "FATAL: PubkeyAuthentication not yes, abort"; exit 1; }

echo "=== Install ufw ==="
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq ufw

echo "=== ufw rules (22 SSH first) ==="
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

echo "=== DOCKER-USER rules for dev ports ==="
DOCKER_PORTS=(6333 6334 8888 8001 8002 9000 9001)
for port in "${DOCKER_PORTS[@]}"; do
  iptables -C DOCKER-USER -p tcp --dport "$port" ! -s 127.0.0.1 -j DROP 2>/dev/null \
    || iptables -I DOCKER-USER 1 -p tcp --dport "$port" ! -s 127.0.0.1 -j DROP
done
iptables -L DOCKER-USER -n | head -12

echo "=== Persist DOCKER-USER in /etc/ufw/after.rules (idempotent) ==="
MARKER='# AVATERRA DOCKER-USER dev port blocks'
AFTER=/etc/ufw/after.rules
if ! grep -q "$MARKER" "$AFTER" 2>/dev/null; then
  cat >> "$AFTER" << 'EOF'

# AVATERRA DOCKER-USER dev port blocks
*filter
:DOCKER-USER - [0:0]
-A DOCKER-USER -p tcp --dport 6333 ! -s 127.0.0.1 -j DROP
-A DOCKER-USER -p tcp --dport 6334 ! -s 127.0.0.1 -j DROP
-A DOCKER-USER -p tcp --dport 8888 ! -s 127.0.0.1 -j DROP
-A DOCKER-USER -p tcp --dport 8001 ! -s 127.0.0.1 -j DROP
-A DOCKER-USER -p tcp --dport 8002 ! -s 127.0.0.1 -j DROP
-A DOCKER-USER -p tcp --dport 9000 ! -s 127.0.0.1 -j DROP
-A DOCKER-USER -p tcp --dport 9001 ! -s 127.0.0.1 -j DROP
COMMIT
EOF
fi

echo "=== Health ==="
curl -sf --max-time 10 http://127.0.0.1:3000/api/health | head -c 150
echo
curl -sf --max-time 10 https://avaterra.pro/api/health | head -c 150
echo
echo "=== Done: ufw restored, SSH port 22 unchanged ==="
