/**
 * Admin: тестовое оповещение админов в Telegram.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getTelegramAdminChatIds, sendAdminTelegramTest } from '@/lib/telegram-admin-notify';
import { getEnvOverrides } from '@/lib/settings';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overrides = await getEnvOverrides();
  if (!overrides.telegram_bot_token) {
    return NextResponse.json({ error: 'Не задан Telegram Bot Token' }, { status: 400 });
  }

  const chatIds = await getTelegramAdminChatIds();
  if (chatIds.length === 0) {
    return NextResponse.json(
      { error: 'Не заданы Chat ID админов (telegram_admin_chat_ids в настройках)' },
      { status: 400 }
    );
  }

  const result = await sendAdminTelegramTest(chatIds);
  if (result.sent === 0) {
    return NextResponse.json(
      { error: result.errors[0] ?? 'Не удалось отправить', ...result },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true, ...result });
}
