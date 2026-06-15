#!/usr/bin/env bash
# Применить протоколы/SOGo/квоту через Mailcow API edit/mailbox (не raw SQL).
# Raw SQL оставляет attribute_hash="" — UI показывает красные крестики и quota 0/∞.
#
#   MAILBOX_USER=info@avaterra.pro bash scripts/prod-mailcow-apply-mailbox-defaults-api-remote.sh
#   bash scripts/prod-mailcow-apply-mailbox-defaults-api-remote.sh info@avaterra.pro yarik@avaterra.pro
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_LOCAL="$SCRIPT_DIR/mailcow-cli-update-sogo-static-view.php"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
[[ -f "$KEY" ]] || KEY="${HOME}/.ssh/avaterra_pro_root"
[[ -f "$KEY" ]] || { echo "no ssh key"; exit 1; }

MAILBOXES=()
if [[ $# -gt 0 ]]; then
  MAILBOXES=("$@")
elif [[ -n "${MAILBOX_USER:-}" ]]; then
  MAILBOXES=("$MAILBOX_USER")
else
  MAILBOXES=(info@avaterra.pro yarik@avaterra.pro support@avaterra.pro)
fi

MAILBOXES_JSON=$(printf '%s\n' "${MAILBOXES[@]}" | jq -R . | jq -s -c .)

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER}@${HOST}" \
  "MAILBOXES_JSON=$(printf '%q' "$MAILBOXES_JSON") bash -se" <<'REMOTE'
set -euo pipefail

cat >/tmp/mailcow-apply-defaults.cjs <<'NODE'
const fs = require('node:fs');

function parseEnvFile(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const line of fs.readFileSync(path, 'utf8').split(/\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const idx = raw.indexOf('=');
    if (idx < 1) continue;
    const key = raw.slice(0, idx).trim();
    let value = raw.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value.replace(/\r/g, '');
  }
  return out;
}

const envFile = parseEnvFile('/opt/ALETHEIA/.env');
for (const [k, v] of Object.entries(envFile)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

const base = String(process.env.MAILCOW_API_URL || 'https://mail.avaterra.pro').replace(/\/+$/, '');
const apiKey = process.env.MAILCOW_API_KEY;
if (!apiKey) throw new Error('MAILCOW_API_KEY missing in /opt/ALETHEIA/.env');

const mailboxes = JSON.parse(process.env.MAILBOXES_JSON || '[]');
if (!mailboxes.length) throw new Error('no mailboxes');

const defaultAttr = {
  quota: '3072',
  force_pw_update: '0',
  force_tfa: '0',
  tls_enforce_in: '0',
  tls_enforce_out: '0',
  sogo_access: '1',
  imap_access: '1',
  pop3_access: '1',
  smtp_access: '1',
  sieve_access: '1',
  eas_access: '1',
  dav_access: '1',
  relayhost: '0',
  quarantine_notification: 'hourly',
  quarantine_category: 'reject',
};

async function apiPost(path, body) {
  const res = await fetch(`${base}/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let raw;
  try { raw = JSON.parse(text); } catch { raw = text; }
  return { status: res.status, raw };
}

async function apiGet(path) {
  const res = await fetch(`${base}/api/v1/${path}`, {
    method: 'GET',
    headers: { 'X-API-Key': apiKey },
  });
  const text = await res.text();
  let raw;
  try { raw = JSON.parse(text); } catch { raw = text; }
  return { status: res.status, raw };
}

function blockingError(raw) {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = String(item.type || '').toLowerCase();
    if (t === 'danger' || t === 'error') {
      const m = item.msg;
      return typeof m === 'string' ? m : JSON.stringify(m).slice(0, 300);
    }
  }
  return null;
}

(async () => {
  const all = await apiGet('get/mailbox/all');
  const list = Array.isArray(all.raw) ? all.raw : [];

  for (const email of mailboxes) {
    const e = String(email).trim().toLowerCase();
    let row = list.find((m) => m && m.username === e);
    if (!row) {
      const one = await apiGet(`get/mailbox/${encodeURIComponent(e)}`);
      row = one.raw && typeof one.raw === 'object' && !Array.isArray(one.raw) ? one.raw : null;
    }
    console.log(`\n=== BEFORE ${e} ===`);
    if (row) {
      console.log(JSON.stringify({
        username: row.username,
        quota: row.quota,
        active: row.active,
        sogo_access: row.sogo_access,
        imap_access: row.imap_access,
        attributes: row.attributes,
      }, null, 2));
    } else {
      console.log('NOT FOUND in Mailcow — skip');
      continue;
    }

    console.log(`=== edit/mailbox ${e} ===`);
    const edit = await apiPost('edit/mailbox', { items: [e], attr: defaultAttr });
    console.log(`HTTP ${edit.status}: ${JSON.stringify(edit.raw).slice(0, 600)}`);
    const err = blockingError(edit.raw);
    if (err) throw new Error(`edit/mailbox ${e}: ${err}`);

    const after = await apiGet(`get/mailbox/${encodeURIComponent(e)}`);
    const row2 = after.raw && typeof after.raw === 'object' && !Array.isArray(after.raw) ? after.raw : null;
    if (row2) {
      console.log(`=== AFTER ${e} ===`);
      console.log(JSON.stringify({
        quota: row2.quota,
        sogo_access: row2.sogo_access,
        imap_access: row2.imap_access,
        smtp_access: row2.smtp_access,
        attributes: row2.attributes,
      }, null, 2));
    }
  }
})();
NODE

node /tmp/mailcow-apply-defaults.cjs

cd /opt/mailcow-dockerized
set -a
# shellcheck disable=SC1091
. ./mailcow.conf
set +a
M=$(docker ps --format '{{.Names}}' | awk '/mysql-mailcow/{print;exit}')

echo ""
echo "=== _sogo_static_view ==="
docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -e \
  "SELECT c_uid, mail, domain FROM _sogo_static_view WHERE mail LIKE '%@avaterra.pro' ORDER BY mail;"

echo ""
echo "=== DB attributes ==="
for u in $(node -e "JSON.parse(process.env.MAILBOXES_JSON).forEach(x=>console.log(x))"); do
  echo "--- $u ---"
  docker exec "$M" mysql -u"$DBUSER" -p"$DBPASS" "$DBNAME" -Nse \
    "SELECT CONCAT('quota=', quota, ' active=', active, ' attrs=', attributes) FROM mailbox WHERE username='$u'" || echo "(missing)"
done

echo ""
echo "Restart sogo + php-fpm..."
docker compose restart sogo-mailcow php-fpm-mailcow >/dev/null
echo "Done."
REMOTE

echo ""
echo "=== SOGo static view rebuild (stdin php) ==="
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" \
  'cd /opt/mailcow-dockerized && docker compose exec -T php-fpm-mailcow php -d display_errors=1 -d error_reporting=E_ALL' \
  < "$PHP_LOCAL"

echo ""
echo "Restart SOGo after static view..."
ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" \
  'cd /opt/mailcow-dockerized && docker compose restart sogo-mailcow >/dev/null && echo OK'
