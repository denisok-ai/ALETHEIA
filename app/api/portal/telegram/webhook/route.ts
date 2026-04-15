/**
 * Telegram bot webhook: receive updates, reply to /progress, /cert, /help.
 * Validates X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET is set.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEnvOverrides } from '@/lib/settings';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return NextResponse.json({ ok: false }, { status: 503 });

  const webhookSecret = overrides.telegram_webhook_secret;
  if (webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const message = body?.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();
    if (!chatId || !text) return NextResponse.json({ ok: true });

    if (text === '/start') {
      await sendTelegramMessage(chatId, 'Добро пожаловать в AVATERRA. Команды: /progress — прогресс, /cert — сертификаты, /help — поддержка.');
      return NextResponse.json({ ok: true });
    }
    if (text === '/progress') {
      await sendTelegramMessage(chatId, 'Откройте личный кабинет на сайте для просмотра прогресса по курсам.');
      return NextResponse.json({ ok: true });
    }
    if (text === '/cert') {
      await sendTelegramMessage(chatId, 'Сертификаты доступны в личном кабинете в разделе «Сертификаты».');
      return NextResponse.json({ ok: true });
    }
    if (text === '/help') {
      await sendTelegramMessage(chatId, 'Напишите в поддержку через личный кабинет или на email.');
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
