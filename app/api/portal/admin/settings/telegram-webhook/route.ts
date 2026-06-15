/**
 * Admin: диагностика Telegram и управление режимом long-polling (delete webhook + setMyCommands).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { registerTelegramBotCommands } from '@/lib/telegram-bot/commands';
import {
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
} from '@/lib/telegram-webhook-setup';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const info = await getTelegramWebhookInfo();
  if (!info.ok) {
    return NextResponse.json({ error: info.error ?? 'Ошибка getWebhookInfo' }, { status: 502 });
  }
  return NextResponse.json({ ...info, mode: 'polling' });
}

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const deleted = await deleteTelegramWebhook({ dropPendingUpdates: false });
  if (!deleted.ok) {
    return NextResponse.json({ error: deleted.error ?? 'deleteWebhook failed' }, { status: 502 });
  }

  const commands = await registerTelegramBotCommands();
  if (!commands.ok) {
    return NextResponse.json({ error: commands.error ?? 'setMyCommands failed' }, { status: 502 });
  }

  const info = await getTelegramWebhookInfo();
  return NextResponse.json({
    success: true,
    mode: 'polling',
    commands_count: commands.count,
    url: info.url,
    pending_update_count: info.pending_update_count,
    note: 'Перезапустите poll worker: systemctl restart aletheia-telegram-poll.service',
  });
}
