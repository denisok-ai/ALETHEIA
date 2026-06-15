#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/mailcow-dockerized
DV=$(docker ps --format '{{.Names}}' | awk '/dovecot-mailcow/{print;exit}')
echo "=== vmail dirs avaterra.pro ==="
docker exec "$DV" ls -la /var/vmail/avaterra.pro/ 2>/dev/null || echo "(no dir)"
echo ""
echo "=== doveadm user info@ ==="
docker exec "$DV" doveadm user info@avaterra.pro 2>&1 || true
echo ""
echo "=== doveadm user admin@ ==="
docker exec "$DV" doveadm user admin@avaterra.pro 2>&1 || true
echo ""
echo "=== get/mailbox/all full list ==="
node <<'NODE'
const fs=require('fs');
const env={};
for(const l of fs.readFileSync('/opt/ALETHEIA/.env','utf8').split(/\n/)){
  const i=l.indexOf('='); if(i<1)continue; env[l.slice(0,i).trim()]=l.slice(i+1).trim().replace(/^"|"$/g,'');
}
(async()=>{
  const base=(env.MAILCOW_API_URL||'https://mail.avaterra.pro').replace(/\/+$/,'');
  const r=await fetch(base+'/api/v1/get/mailbox/all',{headers:{'X-API-Key':env.MAILCOW_API_KEY}});
  const j=await r.json();
  for(const m of j) console.log(m.username, m.domain, m.active);
})();
NODE
REMOTE
