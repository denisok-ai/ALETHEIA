/**
 * Admin: регистрация команд бота Telegram (setMyCommands).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { registerTelegramBotCommands } from '@/lib/telegram-bot/commands';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const result = await registerTelegramBotCommands();
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'setMyCommands failed' }, { status: 502 });
  }
  return NextResponse.json({ success: true, count: result.count });
}
