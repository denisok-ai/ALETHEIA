/**
 * Вебхук старого SMM-бота (@AvaterraSMMBot): воронка там выключена,
 * любое обращение получает редирект в бота портала (@AvaterraProBot).
 * Побочный эффект установки вебхука — long-polling старого бота перестаёт
 * получать обновления (Telegram допускает только одного получателя).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  answerSmmCallback,
  getSmmSecrets,
  sendSmmRedirect,
} from '@/lib/telegram-smm-redirect';

export const dynamic = 'force-dynamic';

/** Не долбить редиректом при серии сообщений: один ответ на чат в 30 секунд. */
const REPLY_COOLDOWN_MS = 30_000;
const lastReplyAt = new Map<number, number>();

function shouldReply(chatId: number): boolean {
  const now = Date.now();
  const prev = lastReplyAt.get(chatId);
  if (prev && now - prev < REPLY_COOLDOWN_MS) return false;
  lastReplyAt.set(chatId, now);
  if (lastReplyAt.size > 1000) {
    for (const [chat, at] of lastReplyAt) {
      if (now - at > REPLY_COOLDOWN_MS) lastReplyAt.delete(chat);
    }
  }
  return true;
}

type Update = {
  message?: { chat?: { id?: number } };
  edited_message?: { chat?: { id?: number } };
  callback_query?: { id?: string; message?: { chat?: { id?: number } } };
};

export async function POST(request: NextRequest) {
  const { botToken, webhookSecret } = await getSmmSecrets();

  // Секрет обязателен: без него любой мог бы дёргать эндпоинт от имени Telegram.
  if (!webhookSecret || request.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!botToken) {
    console.error('[smm-redirect] нет токена бота в настройках');
    return NextResponse.json({ ok: true });
  }

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const callbackId = update.callback_query?.id;
  if (callbackId) await answerSmmCallback(botToken, callbackId);

  const chatId =
    update.message?.chat?.id ??
    update.edited_message?.chat?.id ??
    update.callback_query?.message?.chat?.id;

  if (typeof chatId === 'number' && shouldReply(chatId)) {
    await sendSmmRedirect(botToken, chatId);
  }

  // Telegram повторяет доставку на любой не-2xx — отвечаем 200 всегда.
  return NextResponse.json({ ok: true });
}
