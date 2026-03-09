/**
 * Telegram bot webhook: receive updates, reply to /progress, /cert, /help.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(request: NextRequest) {
  if (!BOT_TOKEN) return NextResponse.json({ ok: false }, { status: 503 });
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
