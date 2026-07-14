#!/usr/bin/env bash
# Диагностика исходящей почты Mailcow на проде: DNS (unbound), nft MAILCOW, очередь Postfix.
# Использование: bash scripts/prod-mailcow-outbound-check-remote.sh [--fix]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
SSH_OPTS=(-o BatchMode=yes)
[[ -f "$KEY" ]] && SSH_OPTS+=(-i "$KEY")
FIX="${1:-}"

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -se "$FIX" <<'REMOTE'
set -euo pipefail
FIX="${1:-}"
MC=/opt/mailcow-dockerized
cd "$MC"

echo "=== mailcow.conf (netfilter / hostname) ==="
grep -E '^(DISABLE_NETFILTER_ISOLATION_RULE|MAILCOW_HOSTNAME|SKIP_UNBOUND)=' mailcow.conf 2>/dev/null || true

echo ""
echo "=== docker compose ps (postfix, unbound, netfilter) ==="
docker compose ps -a unbound-mailcow postfix-mailcow netfilter-mailcow 2>/dev/null || docker compose ps -a

echo ""
echo "=== host resolv + MX list.ru ==="
cat /etc/resolv.conf
dig +short MX list.ru @8.8.8.8 || true
dig +short MX list.ru || true

echo ""
echo "=== unbound / postfix MX list.ru ==="
docker compose exec -T unbound-mailcow dig +short MX list.ru 2>&1 || true
docker compose exec -T postfix-mailcow dig +short MX list.ru @unbound 2>&1 || true

echo ""
echo "=== SMTP probe from postfix (mxs.mail.ru:25) ==="
docker compose exec -T postfix-mailcow bash -lc 'timeout 8 bash -c "echo QUIT | nc -w5 mxs.mail.ru 25"' 2>&1 | head -3 || true

echo ""
echo "=== nft MAILCOW chain ==="
nft list chain ip filter MAILCOW 2>/dev/null || echo "(chain absent or nft unavailable)"

echo ""
echo "=== mail queue ==="
docker compose exec -T postfix-mailcow mailq 2>&1 | head -25 || true

if [[ "$FIX" == "--fix" ]]; then
  echo ""
  echo "=== applying standard repair ==="
  if ! grep -q '^DISABLE_NETFILTER_ISOLATION_RULE=y' mailcow.conf 2>/dev/null; then
    echo "Setting DISABLE_NETFILTER_ISOLATION_RULE=y in mailcow.conf"
    if grep -q '^DISABLE_NETFILTER_ISOLATION_RULE=' mailcow.conf; then
      sed -i 's/^DISABLE_NETFILTER_ISOLATION_RULE=.*/DISABLE_NETFILTER_ISOLATION_RULE=y/' mailcow.conf
    else
      echo 'DISABLE_NETFILTER_ISOLATION_RULE=y' >> mailcow.conf
    fi
  fi
  docker compose up -d unbound-mailcow netfilter-mailcow
  docker compose restart unbound-mailcow postfix-mailcow netfilter-mailcow
  sleep 5
  nft flush chain ip filter MAILCOW 2>/dev/null || true
  docker compose exec -T postfix-mailcow postqueue -f
  echo ""
  echo "=== after fix ==="
  docker compose exec -T postfix-mailcow dig +short MX list.ru @unbound 2>&1 || true
  docker compose exec -T postfix-mailcow mailq 2>&1 | head -10 || true
fi

echo ""
echo OK
REMOTE
