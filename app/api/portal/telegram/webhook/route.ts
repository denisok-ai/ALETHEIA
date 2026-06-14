/**
 * Telegram bot webhook: receive updates, route to modular bot handler.
 * Validates X-Telegram-Bot-Api-Secret-Token when TELEGRAM_WEBHOOK_SECRET is set.
 * Секрет/токен: sync cache (прогрев в instrumentation), без await к БД на горячем пути.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getWebhookSecrets, getWebhookSecretsSync } from '@/lib/telegram-webhook-env';
import { routeTelegramUpdate } from '@/lib/telegram-bot/router';
import type { TelegramUpdate } from '@/lib/telegram-bot/types';

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const sync = getWebhookSecretsSync();
  const secrets = sync.botToken && sync.webhookSecret ? sync : await getWebhookSecrets();

  if (!secrets.botToken) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  if (secrets.webhookSecret) {
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (headerSecret !== secrets.webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = (await request.json()) as TelegramUpdate;
    const chatId = body.message?.chat?.id ?? body.callback_query?.message?.chat?.id;
    const preview = body.message?.text?.slice(0, 80) ?? body.callback_query?.data?.slice(0, 80);
    console.log(
      `[telegram-webhook] recv update=${body.update_id ?? '?'} chat=${chatId ?? '?'} ${preview ?? ''} ack_ms=${Date.now() - t0}`
    );
    if (!body?.message && !body?.callback_query) {
      return NextResponse.json({ ok: true });
    }

    void routeTelegramUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[telegram-webhook]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
