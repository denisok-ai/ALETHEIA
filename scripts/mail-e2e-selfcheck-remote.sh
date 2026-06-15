#!/usr/bin/env bash
# E2E самопроверка почты на проде:
# 1) создаёт тестовый ящик qa-mailtest-*@avaterra.pro через Mailcow API + БД приложения
# 2) проверяет IMAP/SMTP нового ящика
# 3) отправляет письмо на admin@avaterra.pro
# 4) синхронизирует admin@ IMAP и ищет письмо в InboundMessage
# 5) удаляет тестовый ящик
#
# Запуск локально (WSL): bash scripts/mail-e2e-selfcheck-remote.sh
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
TARGET_EMAIL="${TARGET_EMAIL:-admin@avaterra.pro}"
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  KEY="$DEPLOY_SSH_KEY"
elif [[ -f "$HOME/.ssh/avaterra_deploy_nopass" ]]; then
  KEY="$HOME/.ssh/avaterra_deploy_nopass"
else
  KEY="$HOME/.ssh/avaterra_pro_root"
fi
[[ -f "$KEY" ]] || { echo "Нет ключа: $KEY"; exit 1; }

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=30 "${USER}@${HOST}" \
  bash -s -- "$TARGET_EMAIL" <<'REMOTE'
set -euo pipefail
TARGET_EMAIL="$1"
cd /opt/ALETHEIA

cat >/opt/ALETHEIA/.mail-e2e-selfcheck.cjs <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
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

function norm(v) {
  return String(v ?? '').trim().replace(/\r/g, '');
}

function stripSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function tlsRejectUnauthorized() {
  const v = process.env.MAIL_IMAP_TLS_REJECT_UNAUTHORIZED?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

function getKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error('NEXTAUTH_SECRET missing/short');
  return crypto.scryptSync(secret, 'llm-api-key', 32);
}

function encrypt(plain) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
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

function mailcowBlockingError(raw) {
  if (!Array.isArray(raw)) return null;
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = typeof item.type === 'string' ? item.type.toLowerCase() : '';
    if (t !== 'danger' && t !== 'error') continue;
    const m = item.msg;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  return null;
}

async function mailcowFetch(path, body) {
  const base = stripSlash(process.env.MAILCOW_API_URL || 'https://mail.avaterra.pro');
  const apiKey = process.env.MAILCOW_API_KEY;
  if (!apiKey) throw new Error('MAILCOW_API_KEY missing');
  const res = await fetch(`${base}/api/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
  let raw = null;
  try { raw = await res.json(); } catch { raw = null; }
  if (!res.ok) throw new Error(`Mailcow HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 300)}`);
  const block = mailcowBlockingError(raw);
  if (block) throw new Error(`Mailcow API: ${block}`);
  return raw;
}

async function imapVerify({ host, port, user, pass }) {
  const tlsStrict = tlsRejectUnauthorized();
  const client = new ImapFlow({
    host,
    port: Number(port || 993),
    secure: true,
    auth: { user: norm(user).toLowerCase(), pass: norm(pass) },
    logger: false,
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  } finally {
    try { await client.close(); } catch {}
  }
}

async function smtpSend({ host, port, user, pass, from, to, subject, text }) {
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port || 587),
    secure: Number(port || 587) === 465,
    requireTLS: Number(port || 587) === 587,
    auth: { user: norm(user).toLowerCase(), pass: norm(pass) },
    tls: { rejectUnauthorized: false },
  });
  try {
    const info = await transporter.sendMail({ from, to, subject, text });
    transporter.close();
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    transporter.close();
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function syncAdminMailbox(prisma, adminInbound) {
  const password = norm(decrypt(adminInbound.passwordEnc));
  const tlsStrict = tlsRejectUnauthorized();
  const client = new ImapFlow({
    host: adminInbound.imapHost,
    port: adminInbound.imapPort,
    secure: adminInbound.imapTls,
    auth: { user: norm(adminInbound.username).toLowerCase(), pass: password },
    logger: false,
    ...(tlsStrict ? {} : { tls: { rejectUnauthorized: false } }),
  });
  let imported = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(adminInbound.folder || 'INBOX');
    try {
      const sinceUid = adminInbound.lastUid ?? 0;
      const range = sinceUid > 0 ? `${sinceUid + 1}:*` : '1:*';
      const uids = await client.search({ uid: range }, { uid: true });
      for (const uid of (uids || []).slice(-20)) {
        const msg = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });
        if (!msg) continue;
        const subject = msg.envelope?.subject || '(no subject)';
        const fromAddr = msg.envelope?.from?.[0]?.address || '';
        await prisma.inboundMessage.upsert({
          where: { mailboxId_imapUid: { mailboxId: adminInbound.id, imapUid: uid } },
          create: {
            mailboxId: adminInbound.id,
            imapUid: uid,
            fromAddress: fromAddr,
            subject,
            receivedAt: msg.envelope?.date || new Date(),
            bodyText: '',
            snippet: subject.slice(0, 200),
            toAddresses: '[]',
          },
          update: { subject, fromAddress: fromAddr },
        });
        imported++;
      }
    } finally {
      lock.release();
    }
    await client.logout();
    await prisma.inboundMailbox.update({
      where: { id: adminInbound.id },
      data: { lastSyncStatus: 'ok', lastSyncError: null, lastSyncCheckedAt: new Date(), lastSyncedAt: new Date() },
    });
    return { ok: true, imported };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    await prisma.inboundMailbox.update({
      where: { id: adminInbound.id },
      data: { lastSyncStatus: 'error', lastSyncError: msg.slice(0, 500), lastSyncCheckedAt: new Date() },
    });
    return { ok: false, error: msg };
  } finally {
    try { await client.close(); } catch {}
  }
}

async function cleanup(prisma, testEmail, inboundId, domainId) {
  try {
    await mailcowFetch('delete/mailbox', [testEmail]);
    console.log(`cleanup: Mailcow delete ${testEmail}`);
  } catch (e) {
    console.log(`cleanup: Mailcow delete warn: ${e.message}`);
  }
  if (domainId) {
    await prisma.domainMailbox.delete({ where: { id: domainId } }).catch(() => {});
  }
  if (inboundId) {
    await prisma.inboundMessage.deleteMany({ where: { mailboxId: inboundId } }).catch(() => {});
    await prisma.inboundMailbox.delete({ where: { id: inboundId } }).catch(() => {});
  }
}

async function main() {
  const target = norm(process.argv[2] || 'admin@avaterra.pro').toLowerCase();
  const localPart = `qa-mailtest-${Date.now().toString(36)}`;
  const domain = norm(process.env.MAIL_DOMAIN || 'avaterra.pro');
  const testEmail = `${localPart}@${domain}`;
  const password = `Qa${crypto.randomBytes(10).toString('hex')}!x9`;
  const subject = `AVATERRA E2E selfcheck ${new Date().toISOString()}`;
  const imapHost = norm(process.env.MAIL_IMAP_HOST || 'mail.avaterra.pro');
  const imapPort = Number(process.env.MAIL_IMAP_PORT || 993);
  const smtpHost = norm(process.env.MAIL_SMTP_HOST || imapHost);
  const smtpPort = Number(process.env.MAIL_SMTP_PORT || 587);

  console.log('=== MAIL E2E SELFCHECK ===');
  console.log(`test mailbox: ${testEmail}`);
  console.log(`target: ${target}`);
  console.log(`MAIL_PROVISIONING_MODE=${process.env.MAIL_PROVISIONING_MODE || '(unset)'}`);
  console.log(`MAILCOW_API_URL=${process.env.MAILCOW_API_URL ? 'set' : 'missing'}`);
  console.log(`MAILCOW_API_KEY len=${(process.env.MAILCOW_API_KEY || '').length}`);

  const prisma = new PrismaClient();
  let inboundId = null;
  let domainId = null;
  let failed = false;

  try {
    // --- Step 1: Mailcow create + align ---
    console.log('\n[1/6] Mailcow add/mailbox');
    await mailcowFetch('add/mailbox', {
      local_part: localPart,
      domain,
      name: 'QA mail selfcheck',
      quota: '256',
      password,
      password2: password,
      active: '1',
    });

    console.log('[2/6] Mailcow edit/mailbox (password align)');
    await mailcowFetch('edit/mailbox', {
      items: [testEmail],
      attr: { password, password2: password },
    });
    await sleep(2500);

    console.log('[3/6] IMAP verify new mailbox');
    const imapNew = await imapVerify({ host: imapHost, port: imapPort, user: testEmail, pass: password });
    console.log(imapNew.ok ? 'IMAP new mailbox: OK' : `IMAP new mailbox: FAIL ${imapNew.error}`);
    if (!imapNew.ok) { failed = true; throw new Error('New mailbox IMAP auth failed'); }

    console.log('[4/6] Create app DB records');
    const passwordEnc = encrypt(password);
    const inbound = await prisma.inboundMailbox.create({
      data: {
        label: 'QA mail selfcheck',
        imapHost,
        imapPort,
        imapTls: true,
        username: testEmail,
        passwordEnc,
        folder: 'INBOX',
        enabled: true,
        smtpHost,
        smtpPort,
        smtpTls: true,
      },
    });
    inboundId = inbound.id;
    const dm = await prisma.domainMailbox.create({
      data: {
        email: testEmail,
        localPart,
        domain,
        label: 'QA mail selfcheck',
        status: 'active',
        passwordEnc,
        provisioningKind: 'mailcow',
        inboundMailboxId: inbound.id,
      },
    });
    domainId = dm.id;
    console.log(`DB records: inbound=${inboundId} domain=${domainId}`);

    console.log('[5/6] SMTP send test -> target');
    const sent = await smtpSend({
      host: smtpHost,
      port: smtpPort,
      user: testEmail,
      pass: password,
      from: testEmail,
      to: target,
      subject,
      text: `E2E selfcheck from ${testEmail} at ${new Date().toISOString()}`,
    });
    console.log(sent.ok ? `SMTP send: OK messageId=${sent.messageId || 'n/a'}` : `SMTP send: FAIL ${sent.error}`);
    if (!sent.ok) { failed = true; throw new Error('SMTP send failed'); }

    await sleep(4000);

    console.log('[6/6] IMAP sync target + find message');
    const adminInbound = await prisma.inboundMailbox.findFirst({ where: { username: target } });
    if (!adminInbound) throw new Error(`InboundMailbox for ${target} not found`);
    const sync = await syncAdminMailbox(prisma, adminInbound);
    console.log(sync.ok ? `admin sync: OK imported=${sync.imported}` : `admin sync: FAIL ${sync.error}`);
    if (!sync.ok) { failed = true; throw new Error('Admin IMAP sync failed'); }

    const found = await prisma.inboundMessage.findFirst({
      where: { mailboxId: adminInbound.id, subject: { contains: 'AVATERRA E2E selfcheck' } },
      orderBy: { receivedAt: 'desc' },
      select: { id: true, subject: true, fromAddress: true, receivedAt: true },
    });
    if (found) {
      console.log(`MESSAGE FOUND: from=${found.fromAddress} subject=${found.subject}`);
    } else {
      failed = true;
      console.log('MESSAGE NOT FOUND in InboundMessage — listing last 5 subjects:');
      const recent = await prisma.inboundMessage.findMany({
        where: { mailboxId: adminInbound.id },
        orderBy: { receivedAt: 'desc' },
        take: 5,
        select: { subject: true, fromAddress: true, receivedAt: true },
      });
      for (const r of recent) console.log(`  - ${r.fromAddress} | ${r.subject}`);
      throw new Error('Test message not found after sync');
    }

    console.log('\n=== RESULT: PASS ===');
  } catch (e) {
    failed = true;
    console.error('\n=== RESULT: FAIL ===');
    console.error(e && e.message ? e.message : e);
  } finally {
    console.log('\n[cleanup] removing test mailbox');
    await cleanup(prisma, testEmail, inboundId, domainId);
    await prisma.$disconnect();
  }

  process.exit(failed ? 1 : 0);
}

main();
NODE

node /opt/ALETHEIA/.mail-e2e-selfcheck.cjs "$TARGET_EMAIL"
REMOTE
