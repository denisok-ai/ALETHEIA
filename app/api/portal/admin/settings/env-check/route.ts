/**
 * Admin: проверка наличия настроек. Настройки — из БД (Портал → Настройки).
 * DATABASE_URL и NEXTAUTH_SECRET — только из .env (не переносятся в админку).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getEnvOverrides } from '@/lib/settings';
import { getPayKeeperConfigFromSettings } from '@/lib/paykeeper';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overrides = await getEnvOverrides();
  const pkConfig = await getPayKeeperConfigFromSettings();

  return NextResponse.json({
    RESEND_API_KEY: !!overrides.resend_api_key,
    TELEGRAM_BOT_TOKEN: !!overrides.telegram_bot_token,
    TELEGRAM_WEBHOOK_SECRET: !!overrides.telegram_webhook_secret,
    DEEPSEEK_API_KEY: !!overrides.deepseek_api_key,
    OPENAI_API_KEY: !!overrides.openai_api_key,
    PAYKEEPER_SERVER: !!pkConfig?.server,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    CRON_SECRET: !!overrides.cron_secret,
  });
}
