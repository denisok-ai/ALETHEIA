/**
 * Admin: регистрация webhook Telegram (setWebhook) и диагностика getWebhookInfo.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getTelegramWebhookInfo, registerTelegramWebhook } from '@/lib/telegram-webhook-setup';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const info = await getTelegramWebhookInfo();
  if (!info.ok) {
    return NextResponse.json({ error: info.error ?? 'Ошибка getWebhookInfo' }, { status: 502 });
  }
  return NextResponse.json(info);
}

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await registerTelegramWebhook();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'setWebhook failed' }, { status: 502 });
  }
  return NextResponse.json({
    success: true,
    webhookUrl: result.webhookUrl,
    url: result.url,
    pending_update_count: result.pending_update_count,
    last_error_message: result.last_error_message,
  });
}
