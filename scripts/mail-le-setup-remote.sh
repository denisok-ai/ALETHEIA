#!/usr/bin/env bash
# Выпуск LE для mail.* и nginx reverse-proxy → Mailcow. Запуск на сервере: bash -s < mail-le-setup-remote.sh
# Или с локальной машины: ssh root@HOST 'bash -s' < scripts/mail-le-setup-remote.sh
set -euo pipefail

# --- часть 1: с локального WSL: только диагностика DNS/email ---
if [[ "${1:-}" == "probe" ]]; then
  KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
  exec ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$KEY" root@95.181.224.70 bash -se <<'REMOTE'
set -euo pipefail
echo "=== getent mail.avaterra.pro ==="
getent ahosts mail.avaterra.pro || true
echo "=== dig @8.8.8.8 ==="
command -v dig >/dev/null && dig +short mail.avaterra.pro A @8.8.8.8 || true
echo "=== email from renewal ==="
grep -m1 '^email' /etc/letsencrypt/renewal/avaterra.pro.conf 2>/dev/null || echo "no email line"
REMOTE
fi
