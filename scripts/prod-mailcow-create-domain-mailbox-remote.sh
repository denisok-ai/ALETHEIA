#!/usr/bin/env bash
# Создаёт domain/mailbox в MySQL Mailcow из данных приложения, если Mailcow API не настроен.
# Пароль берётся из зашифрованной БД приложения, не выводится.
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

cat >/opt/ALETHEIA/.mailcow-create-domain-mailbox.cjs <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
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

function readMailcowConf(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const idx = raw.indexOf('=');
    if (idx < 1) continue;
    out[raw.slice(0, idx)] = raw.slice(idx + 1);
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

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function dockerContainer(pattern) {
  const names = sh('docker', ['ps', '--format', '{{.Names}}']).split(/\n/).filter(Boolean);
  const found = names.find((n) => n.includes(pattern));
  if (!found) throw new Error(`container not found: ${pattern}`);
  return found;
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
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) throw new Error(`bad email: ${email}`);

  const prisma = new PrismaClient();
  const dm = await prisma.domainMailbox.findUnique({ where: { email }, select: { passwordEnc: true, label: true } });
  const inbound = await prisma.inboundMailbox.findFirst({
    where: { username: email },
    select: { passwordEnc: true, label: true, imapHost: true, imapPort: true },
  });
  if (!dm && !inbound) throw new Error(`${email} not found in app DB`);
  const password = String(decrypt((dm && dm.passwordEnc) || inbound.passwordEnc)).trim().replace(/\r/g, '');
  const fp = crypto.createHash('sha256').update(password).digest('hex').slice(0, 12);
  console.log(`App DB password fingerprint for ${email}: len=${password.length} sha12=${fp}`);

  const dovecot = dockerContainer('dovecot-mailcow');
  const mysql = dockerContainer('mysql-mailcow');
  const hash = sh('docker', ['exec', dovecot, 'doveadm', 'pw', '-s', 'BLF-CRYPT', '-p', password]).trim();
  if (!hash.startsWith('{BLF-CRYPT}')) throw new Error(`Unexpected doveadm hash prefix: ${hash.slice(0, 20)}`);

  const conf = readMailcowConf('/opt/mailcow-dockerized/mailcow.conf');
  const sql = `
INSERT INTO domain (domain, description, aliases, mailboxes, defquota, maxquota, quota, relayhost, backupmx, gal, relay_all_recipients, relay_unknown_only, active)
VALUES (${JSON.stringify(domain)}, 'AVATERRA', 400, 50, 3072, 10240, 102400, 0, 0, 1, 0, 0, 1)
ON DUPLICATE KEY UPDATE active=1, mailboxes=GREATEST(mailboxes, 50), aliases=GREATEST(aliases, 400);

INSERT INTO mailbox (username, password, name, quota, local_part, domain, attributes, custom_attributes, kind, multiple_bookings, active)
VALUES (${JSON.stringify(email)}, ${JSON.stringify(hash)}, ${JSON.stringify((dm && dm.label) || (inbound && inbound.label) || localPart)}, 3072, ${JSON.stringify(localPart)}, ${JSON.stringify(domain)}, '{}', '{}', '', -1, 1)
ON DUPLICATE KEY UPDATE password=VALUES(password), active=1, authsource='mailcow', modified=NOW();

SELECT username, active, domain, authsource FROM mailbox WHERE username=${JSON.stringify(email)};
`;

  const dbUser = conf.DBUSER;
  const dbPass = conf.DBPASS;
  const dbName = conf.DBNAME;
  const out = sh('docker', ['exec', '-i', mysql, 'mysql', `-u${dbUser}`, `-p${dbPass}`, dbName], { input: sql });
  console.log(out.trim());

  await prisma.$disconnect();

  // Сбрасываем возможный auth cache.
  for (const pattern of ['dovecot-mailcow', 'postfix-mailcow']) {
    const c = dockerContainer(pattern);
    sh('docker', ['restart', c], { stdio: 'pipe' });
    console.log(`restarted ${c}`);
  }
  await new Promise((r) => setTimeout(r, 5000));

  const smtp = await smtpVerify({
    host: process.env.MAIL_SMTP_HOST || 'mail.avaterra.pro',
    port: process.env.MAIL_SMTP_PORT || '587',
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
  if (!smtp.ok || !imap.ok) process.exit(3);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
NODE

node /opt/ALETHEIA/.mailcow-create-domain-mailbox.cjs "$MAILBOX_EMAIL"

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart aletheia >/dev/null
  echo "PM2 aletheia restarted"
fi
REMOTE
