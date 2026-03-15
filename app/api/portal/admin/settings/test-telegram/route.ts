/**
 * Admin: проверка токена Telegram (getMe).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { getEnvOverrides } from '@/lib/settings';

export async function POST() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) {
    return NextResponse.json(
      { error: 'Не задан Telegram Bot Token (Переменные окружения или .env)' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: data.description ?? 'Telegram API ошибка' },
        { status: 502 }
      );
    }
    return NextResponse.json({
      success: true,
      botUsername: data.result?.username ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Ошибка запроса к Telegram' },
      { status: 502 }
    );
  }
}
