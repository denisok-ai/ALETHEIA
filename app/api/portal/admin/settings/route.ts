/**
 * Admin: GET system settings (editable keys only), PATCH to update (whitelist).
 * PayKeeper: values are stored in DB; encrypted secrets are returned decrypted only to admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { clearSettingsCache, clearEnvOverridesCache, clearPaymentEmailTemplatesCache } from '@/lib/settings';
import { decrypt, encrypt } from '@/lib/encrypt';
import { clearPayKeeperConfigCache, normalizePayKeeperServer } from '@/lib/paykeeper';

const ALLOWED_KEYS = [
  'site_url',
  'portal_title',
  'resend_from',
  'resend_notify_email',
  'contact_phone',
  'company_legal_address',
  'scorm_max_size_mb',
  'email_payment_course_subject',
  'email_payment_course_body',
  'email_payment_generic_subject',
  'email_payment_generic_body',
  'paykeeper_server',
  'paykeeper_login',
  'paykeeper_password',
  'paykeeper_secret',
  'paykeeper_use_test',
  'paykeeper_test_server',
  'paykeeper_test_login',
  'paykeeper_test_password',
  'paykeeper_test_secret',
  'resend_api_key',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'cron_secret',
  'nextauth_url',
  'openai_api_key',
  'deepseek_api_key',
] as const;

const KEY_CATEGORY: Record<(typeof ALLOWED_KEYS)[number], string> = {
  site_url: 'general',
  portal_title: 'general',
  resend_from: 'email',
  resend_notify_email: 'email',
  contact_phone: 'general',
  company_legal_address: 'general',
  scorm_max_size_mb: 'general',
  email_payment_course_subject: 'payment_email',
  email_payment_course_body: 'payment_email',
  email_payment_generic_subject: 'payment_email',
  email_payment_generic_body: 'payment_email',
  paykeeper_server: 'payments',
  paykeeper_login: 'payments',
  paykeeper_password: 'payments',
  paykeeper_secret: 'payments',
  paykeeper_use_test: 'payments',
  paykeeper_test_server: 'payments',
  paykeeper_test_login: 'payments',
  paykeeper_test_password: 'payments',
  paykeeper_test_secret: 'payments',
  resend_api_key: 'env',
  telegram_bot_token: 'env',
  telegram_webhook_secret: 'env',
  cron_secret: 'env',
  nextauth_url: 'env',
  openai_api_key: 'env',
  deepseek_api_key: 'env',
};

const PAYKEEPER_SENSITIVE = new Set([
  'paykeeper_password',
  'paykeeper_secret',
  'paykeeper_test_password',
  'paykeeper_test_secret',
]);

const SENSITIVE_KEYS = new Set([
  'paykeeper_password', 'paykeeper_secret', 'paykeeper_test_password', 'paykeeper_test_secret',
  'resend_api_key', 'telegram_bot_token', 'telegram_webhook_secret', 'cron_secret',
  'openai_api_key', 'deepseek_api_key',
]);

const PAYKEEPER_SERVER_KEYS = new Set(['paykeeper_server', 'paykeeper_test_server']);

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...ALLOWED_KEYS] } },
  });

  // Для PayKeeper env-fallback намеренно не используется: настройки должны храниться в БД.
  // Для остальных блоков env оставляем как стартовые значения при первой настройке.
  const envFallback: Record<string, string> = {
    site_url: process.env.NEXT_PUBLIC_URL ?? '',
    portal_title: 'AVATERRA',
    resend_from: process.env.RESEND_FROM ?? '',
    resend_notify_email: process.env.RESEND_NOTIFY_EMAIL ?? '',
    contact_phone: '',
    company_legal_address: '',
    scorm_max_size_mb: '200',
    paykeeper_server: '',
    paykeeper_login: '',
    paykeeper_password: '',
    paykeeper_secret: '',
    paykeeper_use_test: '',
    paykeeper_test_server: '',
    paykeeper_test_login: '',
    paykeeper_test_password: '',
    paykeeper_test_secret: '',
    resend_api_key: process.env.RESEND_API_KEY ?? '',
    telegram_bot_token: process.env.TELEGRAM_BOT_TOKEN ?? '',
    telegram_webhook_secret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
    cron_secret: process.env.CRON_SECRET ?? '',
    nextauth_url: process.env.NEXTAUTH_URL ?? '',
    openai_api_key: process.env.OPENAI_API_KEY ?? '',
    deepseek_api_key: process.env.DEEPSEEK_API_KEY ?? '',
    email_payment_course_subject: '',
    email_payment_course_body: '',
    email_payment_generic_subject: '',
    email_payment_generic_body: '',
  };

  const byKey: Record<string, string> = { ...envFallback };
  for (const r of rows) byKey[r.key] = r.value;

  const general: Record<string, string> = {};
  const email: Record<string, string> = {};
  const payment_email: Record<string, string> = {};
  const keysOut: Record<string, string | boolean> = {};
  for (const k of ALLOWED_KEYS) {
    const v = byKey[k] ?? '';
    if (KEY_CATEGORY[k] === 'general') general[k] = v;
    else if (KEY_CATEGORY[k] === 'email') email[k] = v;
    else if (KEY_CATEGORY[k] === 'payment_email') payment_email[k] = v;
    if (PAYKEEPER_SENSITIVE.has(k)) {
      try {
        keysOut[k] = v ? decrypt(v) : '';
      } catch {
        keysOut[k] = '';
      }
    } else if (SENSITIVE_KEYS.has(k)) {
      keysOut[k] = v.length > 0;
    } else {
      keysOut[k] = PAYKEEPER_SERVER_KEYS.has(k) ? normalizePayKeeperServer(v) : v;
    }
  }

  return NextResponse.json({
    settings: { general, email, payment_email },
    keys: keysOut,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  for (const k of ALLOWED_KEYS) {
    if (body[k] === undefined) continue;
    if (SENSITIVE_KEYS.has(k)) {
      if (typeof body[k] === 'string' && body[k].trim().length > 0) {
        try {
          updates[k] = encrypt(body[k].trim());
        } catch {
          return NextResponse.json({ error: `Encryption failed for ${k}` }, { status: 500 });
        }
      }
      continue;
    }
    if (typeof body[k] === 'string') {
      const value = body[k].trim();
      updates[k] = PAYKEEPER_SERVER_KEYS.has(k) ? normalizePayKeeperServer(value) : value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No allowed keys to update' }, { status: 400 });
  }

  const diffForAudit: Record<string, string> = {};
  const savedValues: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(updates)) {
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value, category: KEY_CATEGORY[key as (typeof ALLOWED_KEYS)[number]] ?? null },
      update: { value },
    });
    diffForAudit[key] = SENSITIVE_KEYS.has(key) ? '[set]' : value;
    savedValues[key] = PAYKEEPER_SENSITIVE.has(key) ? String(body[key] ?? '') : SENSITIVE_KEYS.has(key) ? true : value;
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: 'settings.update',
    entity: 'SystemSetting',
    entityId: Object.keys(updates).join(','),
    diff: diffForAudit,
  });

  clearSettingsCache();
  clearEnvOverridesCache();
  clearPaymentEmailTemplatesCache();
  clearPayKeeperConfigCache();

  return NextResponse.json({ success: true, updated: Object.keys(updates), values: savedValues });
}
