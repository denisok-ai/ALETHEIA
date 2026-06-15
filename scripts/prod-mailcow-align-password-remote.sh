#!/usr/bin/env bash
# Синхронизирует пароль admin@avaterra.pro: берёт зашифрованный пароль из БД приложения
# и записывает его в Mailcow через API. Пароль не выводится.
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
MAILBOX_EMAIL="${MAILBOX_EMAIL:-admin@avaterra.pro}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
  KEY="$HOME/.ssh/avaterra_deploy_nopass"
else
  KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа: $KEY"; exit 1; }

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=25 "${USER}@${HOST}" bash -s -- "$MAILBOX_EMAIL" <<'REMOTE'
set -euo pipefail
MAILBOX_EMAIL="$1"
cd /opt/ALETHEIA

cat >/opt/ALETHEIA/.mailcow-align-password.cjs <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
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

function stripSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function norm(s) {
  return String(s || '').trim().replace(/\r/g, '');
}

async function smtpVerify({ host, port, user, pass }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port || 587),
    secure: Number(port || 587) === 465,
    requireTLS: Number(port || 587) === 587,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
  try {
    await transporter.verify();
    transporter.close();
    return { ok: true };
  } catch (e) {
    transporter.close();
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

async function imapVerify({ host, port, user, pass }) {
  const { ImapFlow } = require('imapflow');
  const client = new ImapFlow({
    host,
    port: Number(port || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
    tls: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (e) {
    try { await client.close(); } catch {}
    return { ok: false, error: e && e.message ? e.message : String(e), response: e && e.response };
  }
}

async function main() {
  const email = process.argv[2].trim().toLowerCase();
  const prisma = new PrismaClient();
  const dm = await prisma.domainMailbox.findUnique({
    where: { email },
    select: { email: true, passwordEnc: true },
  });
  const inbound = await prisma.inboundMailbox.findFirst({
    where: { username: email },
    select: { username: true, passwordEnc: true, imapHost: true, imapPort: true },
  });
  if (!dm && !inbound) throw new Error(`Mailbox ${email} not found in app DB`);
  const password = decrypt((dm && dm.passwordEnc) || inbound.passwordEnc);
  const fp = crypto.createHash('sha256').update(password.trim().replace(/\r/g, '')).digest('hex').slice(0, 12);

  const base = stripSlash(process.env.MAILCOW_API_URL || 'https://mail.avaterra.pro');
  const apiKey = process.env.MAILCOW_API_KEY;
  if (!apiKey) throw new Error('MAILCOW_API_KEY missing in /opt/ALETHEIA/.env');

  console.log(`Using app DB password fingerprint sha12=${fp}, len=${password.length}; writing to Mailcow for ${email}`);
  const res = await fetch(`${base}/api/v1/edit/mailbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({
      items: [email],
      attr: { password, password2: password },
    }),
  });
  const text = await res.text();
  console.log(`Mailcow API HTTP ${res.status}: ${text.slice(0, 500)}`);
  if (!res.ok) process.exit(2);

  // Mailcow/Dovecot может применить пароль не мгновенно.
  await new Promise((r) => setTimeout(r, 2500));

  const smtp = await smtpVerify({
    host: norm(process.env.MAIL_SMTP_HOST || 'mail.avaterra.pro'),
    port: norm(process.env.MAIL_SMTP_PORT || '587'),
    user: email,
    pass: password,
  });
  console.log(smtp.ok ? 'SMTP verify: OK' : `SMTP verify: FAIL ${smtp.error}`);

  const imap = await imapVerify({
    host: inbound?.imapHost || 'mail.avaterra.pro',
    port: inbound?.imapPort || 993,
    user: email,
    pass: password,
  });
  console.log(imap.ok ? 'IMAP verify: OK' : `IMAP verify: FAIL ${imap.error}${imap.response ? ` / ${imap.response}` : ''}`);

  await prisma.$disconnect();
  if (!smtp.ok || !imap.ok) process.exit(3);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
NODE

node /opt/ALETHEIA/.mailcow-align-password.cjs "$MAILBOX_EMAIL"

if command -v pm2 >/dev/null 2>&1 && pm2 describe aletheia >/dev/null 2>&1; then
  pm2 restart aletheia >/dev/null
  echo "PM2 aletheia restarted"
elif systemctl is-active --quiet aletheia 2>/dev/null; then
  systemctl restart aletheia
  echo "aletheia.service restarted"
fi
REMOTE
