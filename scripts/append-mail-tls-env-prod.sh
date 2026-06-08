#!/usr/bin/env bash
set -euo pipefail
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
HOST="${DEPLOY_HOST:-95.181.224.70}"
exec ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -i "$KEY" root@"$HOST" bash -se <<'REMOTE'
set -euo pipefail
F=/opt/ALETHEIA/.env
test -f "$F"
if grep -q '^MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=' "$F" 2>/dev/null; then
  echo "MAIL_IMAP_TLS_REJECT_UNAUTHORIZED already present:"
  grep '^MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=' "$F" || true
else
  printf '\n# Dovecot/Mailcow: самоподписанный TLS при IMAP/SMTP — без этого входящие дают self-signed certificate\nMAIL_IMAP_TLS_REJECT_UNAUTHORIZED=false\n' >> "$F"
  echo "Appended MAIL_IMAP_TLS_REJECT_UNAUTHORIZED=false"
fi
REMOTE
