/**
 * Admin: одноразовый импорт значений из process.env в SystemSetting (подтверждение в теле).
 * Секреты шифруются так же, как в PATCH /api/portal/admin/settings.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encrypt';
import { writeAuditLog } from '@/lib/audit';
import { clearSettingsCache, clearEnvOverridesCache, clearPaymentEmailTemplatesCache } from '@/lib/settings';
import { clearPayKeeperConfigCache } from '@/lib/paykeeper';

const IMPORT_MAP: { key: string; env: string; sensitive?: boolean }[] = [
  { key: 'site_url', env: 'NEXT_PUBLIC_URL' },
  { key: 'portal_title', env: 'PORTAL_TITLE' },
  { key: 'resend_from', env: 'RESEND_FROM' },
  { key: 'resend_notify_email', env: 'RESEND_NOTIFY_EMAIL' },
  { key: 'contact_phone', env: 'CONTACT_PHONE' },
  { key: 'company_legal_address', env: 'COMPANY_LEGAL_ADDRESS' },
  { key: 'scorm_max_size_mb', env: 'SCORM_MAX_SIZE_MB' },
  { key: 'paykeeper_server', env: 'PAYKEEPER_SERVER' },
  { key: 'paykeeper_login', env: 'PAYKEEPER_LOGIN' },
  { key: 'paykeeper_password', env: 'PAYKEEPER_PASSWORD', sensitive: true },
  { key: 'paykeeper_secret', env: 'PAYKEEPER_SECRET', sensitive: true },
  { key: 'paykeeper_use_test', env: 'PAYKEEPER_USE_TEST' },
  { key: 'paykeeper_test_server', env: 'PAYKEEPER_TEST_SERVER' },
  { key: 'paykeeper_test_login', env: 'PAYKEEPER_TEST_LOGIN' },
  { key: 'paykeeper_test_password', env: 'PAYKEEPER_TEST_PASSWORD', sensitive: true },
  { key: 'paykeeper_test_secret', env: 'PAYKEEPER_TEST_SECRET', sensitive: true },
  { key: 'resend_api_key', env: 'RESEND_API_KEY', sensitive: true },
  { key: 'telegram_bot_token', env: 'TELEGRAM_BOT_TOKEN', sensitive: true },
  { key: 'telegram_webhook_secret', env: 'TELEGRAM_WEBHOOK_SECRET', sensitive: true },
  { key: 'cron_secret', env: 'CRON_SECRET', sensitive: true },
  { key: 'nextauth_url', env: 'NEXTAUTH_URL' },
  { key: 'openai_api_key', env: 'OPENAI_API_KEY', sensitive: true },
  { key: 'deepseek_api_key', env: 'DEEPSEEK_API_KEY', sensitive: true },
];

const KEY_CATEGORY: Record<string, string> = {
  site_url: 'general',
  portal_title: 'general',
  resend_from: 'email',
  resend_notify_email: 'email',
  contact_phone: 'general',
  company_legal_address: 'general',
  scorm_max_size_mb: 'general',
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

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { error: 'Требуется { "confirm": true } — импорт перезапишет совпадающие ключи в БД значениями из окружения процесса' },
      { status: 400 }
    );
  }

  const updated: string[] = [];
  for (const { key, env, sensitive } of IMPORT_MAP) {
    const raw = process.env[env];
    if (raw === undefined || String(raw).trim() === '') continue;
    const value = String(raw).trim();
    const store = sensitive ? encrypt(value) : value;
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: store, category: KEY_CATEGORY[key] ?? null },
      update: { value: store },
    });
    updated.push(key);
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: 'settings.import_env',
    entity: 'SystemSetting',
    entityId: updated.join(','),
    diff: { keys: updated.length },
  });

  clearSettingsCache();
  clearEnvOverridesCache();
  clearPaymentEmailTemplatesCache();
  clearPayKeeperConfigCache();

  return NextResponse.json({ success: true, imported: updated });
}
