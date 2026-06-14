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
import { SETTINGS_IMPORT_ENV_MAP } from '@/lib/settings-import-env';

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
  for (const { key, env, sensitive } of SETTINGS_IMPORT_ENV_MAP) {
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
