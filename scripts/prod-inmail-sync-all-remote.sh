#!/usr/bin/env bash
# Синхронизирует все включённые InboundMailbox на проде (обновляет lastSyncStatus в UI).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.deploy.env"
  set +a
fi

HOST="${DEPLOY_HOST:-95.181.224.70}"
USER="${DEPLOY_USER:-root}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
  KEY="$HOME/.ssh/avaterra_deploy_nopass"
else
  KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа: $KEY"; exit 1; }

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=25 "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/ALETHEIA

cat >/opt/ALETHEIA/.inmail-sync-all.cjs <<'NODE'
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');

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
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    out[key] = value.replace(/\r/g, '');
  }
  return out;
}

const envFile = parseEnvFile('/opt/ALETHEIA/.env');
for (const [k, v] of Object.entries(envFile)) {
  if (process.env[k] === undefined) process.env[k] = v;
}
process.env.DATABASE_URL ||= 'file:/opt/ALETHEIA/prisma/dev.db';

async function main() {
  const { syncInboundMailbox } = require('./lib/inmail-sync.ts');
  const prisma = new PrismaClient();
  const boxes = await prisma.inboundMailbox.findMany({
    where: { enabled: true },
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });
  for (const mb of boxes) {
    const result = await syncInboundMailbox(mb.id);
    console.log(
      `${mb.username}: ${result.ok ? 'ok' : 'error'} imported=${result.imported}${result.error ? ` err=${result.error}` : ''}`
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
NODE

# Запуск через tsx/next build artifacts — используем скомпилированный модуль из node
node - <<'NODE'
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const crypto = require('node:crypto');
const { ImapFlow } = require('imapflow');

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
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    out[key] = value.replace(/\r/g, '');
  }
  return out;
}

const envFile = parseEnvFile('/opt/ALETHEIA/.env');
for (const [k, v] of Object.entries(envFile)) {
  if (process.env[k] === undefined) process.env[k] = v;
}
process.env.DATABASE_URL ||= 'file:/opt/ALETHEIA/prisma/dev.db';

function getKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('NEXTAUTH_SECRET missing/short');
  return crypto.scryptSync(secret, 'llm-api-key', 32);
}

function decrypt(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

function norm(v) {
  return String(v ?? '').trim().replace(/\r/g, '');
}

function tlsRejectUnauthorized() {
  const v = process.env.MAIL_IMAP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

async function syncOne(prisma, mb) {
  let password;
  try {
    password = norm(decrypt(mb.passwordEnc));
  } catch {
    await prisma.inboundMailbox.update({
      where: { id: mb.id },
      data: {
        lastSyncStatus: 'error',
        lastSyncError: 'Не удалось расшифровать пароль',
        lastSyncCheckedAt: new Date(),
      },
    });
    return { ok: false, error: 'decrypt failed' };
  }

  const tlsStrict = tlsRejectUnauthorized();
  const client = new ImapFlow({
    host: mb.imapHost,
    port: mb.imapPort,
    secure: mb.imapTls,
    auth: { user: norm(mb.username).toLowerCase(), pass: password },
    logger: false,
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });

  try {
    await client.connect();
    await client.logout();
    await prisma.inboundMailbox.update({
      where: { id: mb.id },
      data: {
        lastSyncStatus: 'ok',
        lastSyncError: null,
        lastSyncCheckedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });
    return { ok: true };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    await prisma.inboundMailbox.update({
      where: { id: mb.id },
      data: {
        lastSyncStatus: 'error',
        lastSyncError: msg.slice(0, 500),
        lastSyncCheckedAt: new Date(),
      },
    });
    return { ok: false, error: msg };
  } finally {
    try { await client.close(); } catch {}
  }
}

async function main() {
  const prisma = new PrismaClient();
  const boxes = await prisma.inboundMailbox.findMany({
    where: { enabled: true },
    orderBy: { username: 'asc' },
  });
  for (const mb of boxes) {
    const r = await syncOne(prisma, mb);
    console.log(`${mb.username}: ${r.ok ? 'ok' : 'error'}${r.error ? ` (${r.error})` : ''}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
NODE
REMOTE
