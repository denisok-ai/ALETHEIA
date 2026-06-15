#!/usr/bin/env bash
# Проверка SOGo/IMAP для info@ на проде (без вывода пароля).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then set -a; source "$SCRIPT_DIR/.deploy.env"; set +a; fi
HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
[[ -n "${DEPLOY_SSH_KEY:-}" ]] && KEY="$DEPLOY_SSH_KEY" || KEY="${HOME}/.ssh/avaterra_deploy_nopass"
MAILBOX="${MAILBOX_USER:-info@avaterra.pro}"

ssh -i "$KEY" -o BatchMode=yes "${USER}@${HOST}" bash -se "$MAILBOX" <<'REMOTE'
set -euo pipefail
MAILBOX="$1"
export TEST_MAILBOX="$MAILBOX"
cd /opt/mailcow-dockerized
NG=$(docker ps --format '{{.Names}}' | awk '/nginx-mailcow/{print;exit}')
SG=$(docker ps --format '{{.Names}}' | awk '/sogo-mailcow/{print;exit}')

echo "=== curl SOGo from host ==="
for path in /SOGo/ /SOGo/so/; do
  echo "-- https://mail.avaterra.pro${path} --"
  curl -skSI --max-time 15 "https://mail.avaterra.pro${path}" 2>&1 | head -10
done

echo ""
echo "=== curl SOGo inside nginx (try ports) ==="
for port in 8080 8443 8888 80; do
  code=$(docker exec "$NG" curl -skso /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:${port}/SOGo/" 2>/dev/null || echo fail)
  echo "port $port -> $code"
done

echo ""
echo "=== sogo logs (401/unauthorized) tail ==="
docker logs --tail 40 "$SG" 2>&1 | grep -iE '401|unauthorized|info@|error|fail' || docker logs --tail 15 "$SG" 2>&1

echo ""
echo "=== IMAP auth test via node (app DB password) ==="
cd /opt/ALETHEIA
if [[ ! -d node_modules/.prisma/client ]]; then
  echo "Running prisma generate..."
  npx prisma generate >/dev/null 2>&1 || true
fi
node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

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
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
process.env.DATABASE_URL ||= 'file:/opt/ALETHEIA/prisma/dev.db';

function getKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  return crypto.scryptSync(secret, 'llm-api-key', 32);
}
function decrypt(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const d = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  d.setAuthTag(tag);
  return d.update(enc) + d.final('utf8');
}

(async () => {
  const email = process.env.TEST_MAILBOX || 'info@avaterra.pro';
  const prisma = new PrismaClient();
  const dm = await prisma.domainMailbox.findUnique({ where: { email }, select: { passwordEnc: true } });
  if (!dm) { console.log('No app DB record for', email); process.exit(1); }
  const pass = decrypt(dm.passwordEnc).trim().replace(/\r/g, '');
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host: env.MAIL_IMAP_HOST || 'mail.avaterra.pro',
    port: Number(env.MAIL_IMAP_PORT || 993),
    secure: true,
    auth: { user: email, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    console.log('IMAP auth OK for', email);
    await client.logout();
  } catch (e) {
    console.log('IMAP auth FAIL:', e.message);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }
})();
NODE
REMOTE
