#!/usr/bin/env bash
# Диагностика SMTP/IMAP-аутентификации на проде без вывода секретов.
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

cat >/opt/ALETHEIA/.mail-auth-diagnose.cjs <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

function parseEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const idx = raw.indexOf('=');
    if (idx < 1) continue;
    const k = raw.slice(0, idx).trim();
    let v = raw.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else {
      // Поведение dotenv: комментарий после пробела отрезается, но # внутри пароля без пробела остаётся.
      v = v.replace(/\s+#.*$/, '');
    }
    out[k] = v.replace(/\r/g, '');
  }
  return out;
}

const envFile = parseEnvFile('/opt/ALETHEIA/.env');
for (const [k, v] of Object.entries(envFile)) {
  if (process.env[k] === undefined) process.env[k] = v;
}
process.env.DATABASE_URL ||= 'file:/opt/ALETHEIA/prisma/dev.db';

function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('NEXTAUTH_SECRET missing/short');
  return crypto.scryptSync(secret, 'llm-api-key', 32);
}

function decrypt(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

function norm(v) {
  return String(v ?? '').trim().replace(/\r/g, '');
}

function fp(label, value) {
  const v = norm(value);
  return {
    label,
    present: v.length > 0,
    len: v.length,
    sha12: v ? crypto.createHash('sha256').update(v).digest('hex').slice(0, 12) : '',
  };
}

async function smtpVerify(label, cfg) {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: Number(cfg.port || 587),
      secure: Number(cfg.port || 587) === 465,
      requireTLS: Number(cfg.port || 587) === 587,
      auth: { user: cfg.user, pass: cfg.pass },
      tls: { rejectUnauthorized: false },
    });
    await transporter.verify();
    console.log(`[SMTP ${label}] OK user=${cfg.user} host=${cfg.host}:${cfg.port}`);
  } catch (e) {
    console.log(`[SMTP ${label}] FAIL user=${cfg.user} host=${cfg.host}:${cfg.port}: ${e && e.message ? e.message : e}`);
  }
}

async function imapConnect(label, cfg) {
  try {
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: cfg.host,
      port: Number(cfg.port || 993),
      secure: true,
      auth: { user: cfg.user, pass: cfg.pass },
      logger: false,
      tls: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.logout();
    console.log(`[IMAP ${label}] OK user=${cfg.user} host=${cfg.host}:${cfg.port}`);
  } catch (e) {
    console.log(`[IMAP ${label}] FAIL user=${cfg.user} host=${cfg.host}:${cfg.port}: ${e && e.message ? e.message : e}`);
    if (e && e.response) console.log(`[IMAP ${label}] response=${e.response}`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['email_transport', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_secure', 'smtp_password', 'resend_from'] } },
  });
  const byKey = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  const domain = await prisma.domainMailbox.findUnique({
    where: { email: 'admin@avaterra.pro' },
    select: { email: true, passwordEnc: true, inboundMailboxId: true },
  });
  const inbound = await prisma.inboundMailbox.findFirst({
    where: { username: 'admin@avaterra.pro' },
    select: { username: true, passwordEnc: true, imapHost: true, imapPort: true, smtpHost: true, smtpPort: true },
  });

  let smtpDbPass = '';
  let domainPass = '';
  let inboundPass = '';
  try { if (byKey.smtp_password) smtpDbPass = decrypt(byKey.smtp_password); } catch (e) { console.log('[decrypt smtp_password] FAIL', e.message); }
  try { if (domain?.passwordEnc) domainPass = decrypt(domain.passwordEnc); } catch (e) { console.log('[decrypt DomainMailbox] FAIL', e.message); }
  try { if (inbound?.passwordEnc) inboundPass = decrypt(inbound.passwordEnc); } catch (e) { console.log('[decrypt InboundMailbox] FAIL', e.message); }

  console.log('=== fingerprints (без значений паролей) ===');
  for (const x of [
    fp('MAIL_SMTP_PASSWORD .env', envFile.MAIL_SMTP_PASSWORD),
    fp('SystemSetting.smtp_password decrypted', smtpDbPass),
    fp('DomainMailbox.passwordEnc decrypted', domainPass),
    fp('InboundMailbox.passwordEnc decrypted', inboundPass),
  ]) console.log(`${x.label}: present=${x.present} len=${x.len} sha12=${x.sha12}`);

  console.log('=== public config ===');
  console.log({
    MAIL_USE_OWN_SMTP: envFile.MAIL_USE_OWN_SMTP || '',
    EMAIL_TRANSPORT_env: envFile.EMAIL_TRANSPORT || '',
    MAIL_SMTP_HOST: envFile.MAIL_SMTP_HOST || '',
    MAIL_SMTP_PORT: envFile.MAIL_SMTP_PORT || '',
    MAIL_SMTP_USER: envFile.MAIL_SMTP_USER || '',
    email_transport_db: byKey.email_transport || '',
    smtp_host_db: byKey.smtp_host || '',
    smtp_port_db: byKey.smtp_port || '',
    smtp_user_db: byKey.smtp_user || '',
    resend_from_db: byKey.resend_from || '',
  });

  console.log('=== auth tests ===');
  await smtpVerify('env MAIL_SMTP_*', {
    host: norm(envFile.MAIL_SMTP_HOST || 'mail.avaterra.pro'),
    port: norm(envFile.MAIL_SMTP_PORT || '587'),
    user: norm(envFile.MAIL_SMTP_USER || '').toLowerCase(),
    pass: norm(envFile.MAIL_SMTP_PASSWORD || ''),
  });
  await smtpVerify('DB SystemSetting', {
    host: norm(byKey.smtp_host || 'mail.avaterra.pro'),
    port: norm(byKey.smtp_port || '587'),
    user: norm(byKey.smtp_user || '').toLowerCase(),
    pass: norm(smtpDbPass),
  });
  if (inbound) {
    await imapConnect('InboundMailbox', {
      host: inbound.imapHost,
      port: inbound.imapPort,
      user: inbound.username.toLowerCase(),
      pass: norm(inboundPass),
    });
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE

node /opt/ALETHEIA/.mail-auth-diagnose.cjs

echo
echo "=== mailcow containers ==="
docker ps --format '{{.Names}}' | awk '/mailcow|postfix|dovecot|smtp/ {print}'

echo
echo "=== recent postfix/dovecot logs (auth-related) ==="
for c in $(docker ps --format '{{.Names}}' | awk '/postfix-mailcow|dovecot-mailcow/ {print}'); do
  echo "--- $c ---"
  docker logs --since 30m "$c" 2>&1 | awk 'BEGIN{IGNORECASE=1} /sasl|auth|535|fail|admin@avaterra|warning|error/ {print}' | tail -80
done
REMOTE
