#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
node <<'NODE'
const fs = require('node:fs');
function parseEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const i = raw.indexOf('=');
    if (i < 1) continue;
    out[raw.slice(0, i).trim()] = raw.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return out;
}
const env = parseEnv('/opt/ALETHEIA/.env');
const base = (env.MAILCOW_API_URL || 'https://mail.avaterra.pro').replace(/\/+$/, '');
const key = env.MAILCOW_API_KEY;
(async () => {
  const res = await fetch(`${base}/api/v1/get/mailbox/all`, {
    method: 'GET',
    headers: { 'X-API-Key': key },
  });
  const j = await res.json();
  console.log('HTTP', res.status, 'type', typeof j, 'count', Array.isArray(j) ? j.length : 'n/a');
  if (!Array.isArray(j)) { console.log(JSON.stringify(j).slice(0, 800)); return; }
  const av = j.filter(m => m.domain === 'avaterra.pro');
  console.log('avaterra.pro mailboxes from API:', av.length);
  for (const m of av) {
    console.log(m.username, 'active=', m.active, 'quota=', m.quota, 'sogo=', m.sogo_access, 'imap=', m.imap_access);
  }
  for (const e of ['info@avaterra.pro','yarik@avaterra.pro','support@avaterra.pro','admin@avaterra.pro']) {
    const res2 = await fetch(`${base}/api/v1/get/mailbox/${encodeURIComponent(e)}`, {
      method: 'GET',
      headers: { 'X-API-Key': key },
    });
    const t = await res2.text();
    console.log(`GET /get/mailbox/${e}: HTTP ${res2.status} ${t.slice(0, 200)}`);
  }
})();
NODE
REMOTE
