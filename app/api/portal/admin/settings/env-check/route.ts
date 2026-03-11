/**
 * Admin: return which env vars are set (no values). Учитываются и .env, и значения из БД (Переменные окружения).
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
    RESEND_API_KEY: !!(overrides.resend_api_key || process.env.RESEND_API_KEY),
    TELEGRAM_BOT_TOKEN: !!(overrides.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN),
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
    PAYKEEPER_SERVER: !!(pkConfig?.server || process.env.PAYKEEPER_SERVER),
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    CRON_SECRET: !!(overrides.cron_secret || process.env.CRON_SECRET),
  });
}
