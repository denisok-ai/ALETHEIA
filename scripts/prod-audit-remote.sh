#!/bin/bash
# Remote production audit script — run on VPS via SSH
set -euo pipefail

BACKUP_DIR=~/backups/$(date +%Y%m%d)

phase0_backup() {
  echo "=== PHASE 0: Safety backups ==="
  mkdir -p "$BACKUP_DIR"
  cp /opt/ALETHEIA/prisma/dev.db "$BACKUP_DIR/dev.db.bak"
  tar -czf "$BACKUP_DIR/public-uploads.tar.gz" -C /opt/ALETHEIA/public uploads 2>/dev/null || true
  cp /opt/ALETHEIA/.env "$BACKUP_DIR/.env.bak"
  echo "=== BACKUP VERIFICATION ==="
  ls -lah "$BACKUP_DIR"
  stat -c "%s bytes" "$BACKUP_DIR/dev.db.bak"
  test -s "$BACKUP_DIR/dev.db.bak" && echo "dev.db.bak OK (non-zero)" || { echo "dev.db.bak FAILED"; exit 1; }
}

phase1_deploy() {
  echo "=== PHASE 1: Clean prod deploy ==="
  cd /opt/ALETHEIA
  BEFORE_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  echo "Before commit: $BEFORE_COMMIT"
  curl -sf http://127.0.0.1:3000/api/health && echo " health OK before" || echo " health FAIL before"
  
  git fetch origin
  # Backup any local tracked modifications
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git stash push -m "prod-audit-$(date +%Y%m%d)" || true
  fi
  git reset --hard origin/main
  
  if [ -f scripts/deploy-pull.sh ]; then
    sudo bash scripts/deploy-pull.sh
  else
    npm ci
    npx prisma generate
    npx prisma migrate deploy
    rm -rf .next
    npm run build
    systemctl restart aletheia
  fi
  
  sleep 5
  AFTER_COMMIT=$(git rev-parse --short HEAD)
  echo "After commit: $AFTER_COMMIT"
  curl -sf http://127.0.0.1:3000/api/health && echo " health OK after" || echo " health FAIL after"
}

phase2_fail2ban() {
  echo "=== PHASE 2: fail2ban ==="
  if ! dpkg -l fail2ban 2>/dev/null | grep -q ^ii; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq fail2ban
  fi
  
  cat > /etc/fail2ban/jail.local << 'JAILEOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
JAILEOF

  systemctl enable fail2ban
  systemctl restart fail2ban
  sleep 2
  fail2ban-client status
}

phase3_sharp() {
  echo "=== PHASE 3: sharp ==="
  cd /opt/ALETHEIA
  npm install sharp --save
  systemctl restart aletheia
  sleep 5
  curl -sf http://127.0.0.1:3000/api/health && echo " health OK after sharp" || echo " health FAIL after sharp"
}

phase4_mailcow() {
  echo "=== PHASE 4: Mailcow memory limits ==="
  MAILCOW_DIR=/opt/mailcow-dockerized
  if [ ! -d "$MAILCOW_DIR" ]; then
    echo "Mailcow dir not found, skipping"
    return 0
  fi
  
  OVERRIDE="$MAILCOW_DIR/docker-compose.override.yml"
  cat > "$OVERRIDE" << 'MCOWEOF'
# Memory limits for heavy Mailcow containers (SOGo MUST stay enabled)
services:
  mysql-mailcow:
    mem_limit: 512m
  sogo-mailcow:
    mem_limit: 384m
  rspamd-mailcow:
    mem_limit: 256m
MCOWEOF

  # Add clamd if running
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q clamd-mailcow; then
    cat >> "$OVERRIDE" << 'CLAMEOF'
  clamd-mailcow:
    mem_limit: 256m
CLAMEOF
  fi

  cd "$MAILCOW_DIR"
  docker compose up -d
  sleep 10
  docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -E 'mailcow|sogo|mysql|rspamd|clamd' || true
  docker ps --format '{{.Names}}' | grep -q sogo-mailcow && echo "SOGo container UP" || echo "SOGo container MISSING"
}

phase5_docker_logs() {
  echo "=== PHASE 5: Docker log rotation ==="
  mkdir -p /etc/docker
  if [ -f /etc/docker/daemon.json ]; then
    cp /etc/docker/daemon.json /etc/docker/daemon.json.bak.$(date +%Y%m%d)
    python3 - << 'PYEOF'
import json, os
path = "/etc/docker/daemon.json"
with open(path) as f:
    cfg = json.load(f)
log = cfg.get("log-driver", {})
if isinstance(log, str):
    cfg["log-driver"] = "json-file"
cfg.setdefault("log-opts", {})
cfg["log-opts"]["max-size"] = "10m"
cfg["log-opts"]["max-file"] = "3"
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
print("Merged daemon.json:", json.dumps(cfg, indent=2))
PYEOF
  else
    cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
DOCKEREOF
  fi
  
  systemctl restart docker
  sleep 5
  cd /opt/mailcow-dockerized && docker compose up -d
  sleep 10
  docker info 2>/dev/null | grep -A3 "Logging Driver" || true
}

phase6_hardening() {
  echo "=== PHASE 6: Additional hardening ==="
  
  # Check nginx - no proxy_cache on location /
  if grep -A20 'location / {' /etc/nginx/sites-enabled/aletheia 2>/dev/null | grep -q proxy_cache; then
    echo "WARNING: proxy_cache found in location /"
  else
    echo "nginx location / OK (no proxy_cache)"
  fi
  
  # Verify systemd settings
  systemctl cat aletheia 2>/dev/null | grep -E 'EnvironmentFile|NODE_OPTIONS|Restart=' || true
  
  # Migrations
  cd /opt/ALETHEIA
  npx prisma migrate deploy
  
  # Journal check
  journalctl -u aletheia -n 20 --no-pager || true
  
  # Logo check
  curl -sf -o /dev/null -w "logo.png HTTP %{http_code}\n" https://avaterra.pro/images/logo.png -k || true
}

# Run phases based on argument or all
PHASE="${1:-all}"
case "$PHASE" in
  0) phase0_backup ;;
  1) phase1_deploy ;;
  2) phase2_fail2ban ;;
  3) phase3_sharp ;;
  4) phase4_mailcow ;;
  5) phase5_docker_logs ;;
  6) phase6_hardening ;;
  all)
    phase0_backup
    phase1_deploy
    phase2_fail2ban
    phase3_sharp
    phase4_mailcow
    phase5_docker_logs
    phase6_hardening
    ;;
  *) echo "Unknown phase: $PHASE"; exit 1 ;;
esac

echo "=== Phase $PHASE complete ==="
