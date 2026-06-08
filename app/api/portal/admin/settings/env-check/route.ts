/**
 * Admin: проверка наличия настроек. Настройки — из БД (Портал → Настройки).
 * DATABASE_URL и NEXTAUTH_SECRET — только из .env (не переносятся в админку).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getEnvOverrides } from '@/lib/settings';
import { getLlmApiKey } from '@/lib/llm';
import { getPayKeeperConfigFromSettings } from '@/lib/paykeeper';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden', accessDenied: true }, { status: 403 });

  try {
    const overrides = await getEnvOverrides();
    const chatbotApiKeyResolved = !!(await getLlmApiKey('chatbot'));
    const pkConfig = await getPayKeeperConfigFromSettings();
    const smtpReady = !!(
      overrides.smtp_host?.trim() &&
      overrides.smtp_user?.trim() &&
      overrides.smtp_password?.trim()
    );

    return NextResponse.json({
      RESEND_API_KEY: !!overrides.resend_api_key,
      SMTP_CONFIGURED: smtpReady,
      MAIL_OUTBOUND_OK: !!(overrides.resend_api_key || smtpReady),
      TELEGRAM_BOT_TOKEN: !!overrides.telegram_bot_token,
      TELEGRAM_WEBHOOK_SECRET: !!overrides.telegram_webhook_secret,
      /** Реально ли чат получит ключ (БД Настройки AI + переменные, с тем же порядком, что /api/chat). */
      CHATBOT_LLM_READY: chatbotApiKeyResolved,
      DEEPSEEK_API_KEY: !!overrides.deepseek_api_key,
      OPENAI_API_KEY: !!overrides.openai_api_key,
      PAYKEEPER_SERVER: !!pkConfig?.server,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      CRON_SECRET: !!overrides.cron_secret,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[env-check]', e);
    return NextResponse.json(
      {
        loadError: msg,
        RESEND_API_KEY: false,
        SMTP_CONFIGURED: false,
        MAIL_OUTBOUND_OK: false,
        TELEGRAM_BOT_TOKEN: false,
        TELEGRAM_WEBHOOK_SECRET: false,
        CHATBOT_LLM_READY: false,
        DEEPSEEK_API_KEY: false,
        OPENAI_API_KEY: false,
        PAYKEEPER_SERVER: false,
        NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
        DATABASE_URL: !!process.env.DATABASE_URL,
        CRON_SECRET: false,
      },
      { status: 200 }
    );
  }
}
