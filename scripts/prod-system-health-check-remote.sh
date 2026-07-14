#!/usr/bin/env bash
# Read-only аудит модулей прода (systemd, cron, nginx, docker, security-verify).
# Использование: bash scripts/prod-system-health-check-remote.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20)
[[ -f "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
OUT="${SCRIPT_DIR}/../prod-system-health-report.txt"

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -s > "$OUT" <<'REMOTE'
set -u
echo "=== AVATERRA prod health $(date -Iseconds) ==="
for m in aletheia nginx aletheia-telegram-poll aletheia-jobs; do echo "--- $m ---"; systemctl status "$m" --no-pager -l 2>&1 | head -35; done
echo "--- aletheia errors 7d ---"; journalctl -u aletheia --since "7 days ago" --no-pager -p err..alert 2>&1 | tail -80
echo "--- aletheia grep ---"; journalctl -u aletheia --since "7 days ago" --no-pager 2>&1 | grep -iE "error|fatal|paykeeper|webhook|cron|installment|inmail" | tail -50 || true
echo "--- nginx ---"; nginx -t 2>&1; tail -60 /var/log/nginx/error.log 2>&1
echo "--- telegram ---"; journalctl -u aletheia-telegram-poll --since "7 days ago" --no-pager 2>&1 | tail -50
echo "--- cron ---"; cat /etc/cron.d/aletheia-http-cron 2>&1; journalctl -t CRON --since "3 days ago" --no-pager 2>&1 | tail -30
echo "--- docker ---"; docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>&1 | head -40
echo "--- ufw / DOCKER-USER ---"; ufw status verbose 2>&1 | head -35; iptables -L DOCKER-USER -n -v 2>&1 | head -12
echo "--- fail2ban ---"; systemctl is-active fail2ban 2>&1; fail2ban-client status 2>&1 | head -15 || true
echo "--- resources ---"; df -h; free -h
echo "--- certs ---"; certbot certificates 2>&1 | head -50
echo "--- health ---"; curl -sS --max-time 10 http://127.0.0.1:3000/api/health; echo; curl -sS --max-time 10 https://avaterra.pro/api/health; echo
echo "--- mailcow ---"; (cd /opt/mailcow-dockerized && docker compose ps 2>&1 | head -25) || true
echo "--- security-verify ---"; (cd /opt/ALETHEIA && bash scripts/security-verify-prod.sh 2>&1) | tail -40
echo "--- systemd failed ---"; systemctl --failed --no-pager 2>&1
echo "=== END ==="
REMOTE

echo "Report: $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
