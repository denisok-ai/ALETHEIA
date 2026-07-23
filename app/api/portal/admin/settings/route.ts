/**
 * Admin: GET system settings (editable keys only), PATCH to update (whitelist).
 * PayKeeper: values are stored in DB; encrypted secrets are returned decrypted only to admins.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { clearSettingsCache, clearEnvOverridesCache, clearPaymentEmailTemplatesCache, resolvePaymentEmailField, DEFAULT_PAYMENT_EMAIL_TEMPLATES } from '@/lib/settings';
import { decrypt, encrypt } from '@/lib/encrypt';
import { clearPayKeeperConfigCache, normalizePayKeeperServer } from '@/lib/paykeeper';
import { getMailDomain, getMailSmtpHost, getMailSmtpPort } from '@/lib/mail-stack-env';
import { isLoopbackHostname, normalizeSiteUrl } from '@/lib/site-url';

const ALLOWED_KEYS = [
  'site_url',
  'portal_title',
  'resend_from',
  'resend_notify_email',
  'contact_phone',
  'company_legal_address',
  'google_site_verification',
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
  'email_transport',
  'resend_api_key',
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_password',
  'smtp_secure',
  'telegram_admin_chat_ids',
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
  google_site_verification: 'general',
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
  email_transport: 'env',
  resend_api_key: 'env',
  smtp_host: 'env',
  smtp_port: 'env',
  smtp_user: 'env',
  smtp_password: 'env',
  smtp_secure: 'env',
  telegram_admin_chat_ids: 'env',
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
  'paykeeper_password',
  'paykeeper_secret',
  'paykeeper_test_password',
  'paykeeper_test_secret',
  'resend_api_key',
  'smtp_password',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'cron_secret',
  'openai_api_key',
  'deepseek_api_key',
]);

const PAYKEEPER_SERVER_KEYS = new Set(['paykeeper_server', 'paykeeper_test_server']);

/** Допустимые значения транспорта почты (пусто = авто). */
function normalizeEmailTransport(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === '' || v === 'auto') return '';
  if (v === 'resend' || v === 'smtp') return v;
  return null;
}

function normalizeSmtpSecure(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === '') return '';
  if (v === 'true' || v === '1') return 'true';
  if (v === 'false' || v === '0') return 'false';
  return null;
}

function validateSettingsPatchValue(key: string, raw: unknown): { ok: true; value: string } | { ok: false; message: string } {
  if (raw === undefined) return { ok: false, message: 'Отсутствует значение' };
  if (typeof raw !== 'string') return { ok: false, message: 'Ожидалась строка' };

  if (key === 'email_transport') {
    const n = normalizeEmailTransport(raw);
    if (n === null) {
      return { ok: false, message: 'email_transport: укажите auto (или пусто), resend или smtp' };
    }
    return { ok: true, value: n };
  }

  if (key === 'smtp_port') {
    const trimmed = raw.trim();
    if (trimmed === '') return { ok: true, value: '' };
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 1 || n > 65535) {
      return { ok: false, message: 'smtp_port: укажите число от 1 до 65535' };
    }
    return { ok: true, value: String(n) };
  }

  if (key === 'smtp_secure') {
    const n = normalizeSmtpSecure(raw);
    if (n === null) {
      return { ok: false, message: 'smtp_secure: допустимо пусто, true/false или 1/0' };
    }
    return { ok: true, value: n };
  }

  if (key === 'scorm_max_size_mb') {
    const trimmed = raw.trim();
    if (trimmed === '') return { ok: true, value: '' };
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 1 || n > 10000) {
      return { ok: false, message: 'scorm_max_size_mb: от 1 до 10000' };
    }
    return { ok: true, value: String(n) };
  }

  if (key === 'nextauth_url') {
    const trimmed = raw.trim();
    if (trimmed === '') return { ok: true, value: '' };
    try {
      const host = new URL(normalizeSiteUrl(trimmed)).hostname;
      if (process.env.NODE_ENV === 'production' && isLoopbackHostname(host)) {
        return {
          ok: false,
          message:
            'nextauth_url: на продакшене нельзя указывать localhost — сломается сессия NextAuth и админка. Укажите публичный https://… вашего сайта или оставьте поле пустым (будет site_url / .env).',
        };
      }
    } catch {
      return { ok: false, message: 'nextauth_url: укажите корректный URL, например https://example.com' };
    }
    return { ok: true, value: trimmed };
  }

  return { ok: true, value: raw.trim() };
}

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [...ALLOWED_KEYS] } },
  });

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
    email_transport: process.env.EMAIL_TRANSPORT ?? '',
    resend_api_key: process.env.RESEND_API_KEY ?? '',
    smtp_host: process.env.SMTP_HOST ?? '',
    smtp_port: process.env.SMTP_PORT ?? String(getMailSmtpPort()),
    smtp_user: process.env.SMTP_USER ?? '',
    smtp_password: process.env.SMTP_PASSWORD ?? '',
    smtp_secure: process.env.SMTP_SECURE ?? '',
    telegram_admin_chat_ids: process.env.TELEGRAM_ADMIN_CHAT_IDS ?? '',
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
    else if (KEY_CATEGORY[k] === 'payment_email') {
      const raw = v ?? '';
      if (k === 'email_payment_course_subject') {
        payment_email[k] = resolvePaymentEmailField(raw, DEFAULT_PAYMENT_EMAIL_TEMPLATES.courseSubject);
      } else if (k === 'email_payment_course_body') {
        payment_email[k] = resolvePaymentEmailField(raw, DEFAULT_PAYMENT_EMAIL_TEMPLATES.courseBody);
      } else if (k === 'email_payment_generic_subject') {
        payment_email[k] = resolvePaymentEmailField(raw, DEFAULT_PAYMENT_EMAIL_TEMPLATES.genericSubject);
      } else if (k === 'email_payment_generic_body') {
        payment_email[k] = resolvePaymentEmailField(raw, DEFAULT_PAYMENT_EMAIL_TEMPLATES.genericBody);
      }
    }
    if (PAYKEEPER_SENSITIVE.has(k) || SENSITIVE_KEYS.has(k)) {
      keysOut[k] = v.length > 0;
    } else {
      keysOut[k] = PAYKEEPER_SERVER_KEYS.has(k)
        ? normalizePayKeeperServer(v)
        : KEY_CATEGORY[k] === 'payment_email'
          ? payment_email[k]
          : v;
    }
  }

  const outboundMailPreset = {
    /** Подсказки для формы «Доставка» под встроенный SMTP (Mailcow и env MAIL_*). */
    smtpHost: getMailSmtpHost(),
    smtpPort: String(getMailSmtpPort()),
    senderExample: `notifications@${getMailDomain()}`,
    notifyExample: `admin@${getMailDomain()}`,
  };

  return NextResponse.json({
    settings: { general, email, payment_email },
    keys: keysOut,
    outboundMailPreset,
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
      const validated = validateSettingsPatchValue(k, body[k]);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.message }, { status: 400 });
      }
      const value = validated.value.trim();
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
    savedValues[key] = PAYKEEPER_SENSITIVE.has(key)
      ? String(body[key] ?? '')
      : SENSITIVE_KEYS.has(key)
        ? true
        : value;
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
