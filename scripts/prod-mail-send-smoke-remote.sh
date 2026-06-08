#!/usr/bin/env bash
# Проверяет реальную SMTP-отправку через Mailcow с текущими настройками приложения.
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

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER}@${HOST}" bash -se <<'REMOTE'
set -euo pipefail
cd /opt/ALETHEIA
cat >/opt/ALETHEIA/.mail-send-smoke.cjs <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

function parseEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const i = raw.indexOf('=');
    if (i < 1) continue;
    let v = raw.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[raw.slice(0, i).trim()] = v.replace(/\r/g, '');
  }
  return out;
}
const env = parseEnv('/opt/ALETHEIA/.env');
process.env.DATABASE_URL ||= 'file:/opt/ALETHEIA/prisma/dev.db';
process.env.NEXTAUTH_SECRET ||= env.NEXTAUTH_SECRET;
function decrypt(encoded) {
  const key = crypto.scryptSync(process.env.NEXTAUTH_SECRET, 'llm-api-key', 32);
  const buf = Buffer.from(encoded, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 16));
  decipher.setAuthTag(buf.subarray(16, 32));
  return decipher.update(buf.subarray(32)) + decipher.final('utf8');
}
(async () => {
  const prisma = new PrismaClient();
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: ['resend_from', 'resend_notify_email', 'smtp_user', 'smtp_password', 'smtp_host', 'smtp_port'] } } });
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const pass = decrypt(s.smtp_password);
  const transporter = nodemailer.createTransport({
    host: s.smtp_host || env.MAIL_SMTP_HOST || 'mail.avaterra.pro',
    port: Number(s.smtp_port || env.MAIL_SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: (s.smtp_user || env.MAIL_SMTP_USER).trim().toLowerCase(), pass: pass.trim().replace(/\r/g, '') },
    tls: { rejectUnauthorized: false },
  });
  try {
    const info = await transporter.sendMail({
      from: s.resend_from || s.smtp_user,
      to: s.resend_notify_email || s.smtp_user,
      subject: 'AVATERRA smoke SMTP',
      text: 'SMTP smoke test',
    });
    console.log('SEND OK', info.accepted);
  } catch (e) {
    console.log('SEND FAIL', e && e.message ? e.message : e);
    process.exit(2);
  } finally {
    transporter.close();
    await prisma.$disconnect();
  }
})();
NODE
node /opt/ALETHEIA/.mail-send-smoke.cjs
REMOTE
