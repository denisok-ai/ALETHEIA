#!/usr/bin/env npx tsx
/**
 * Замер latency: webhook ack + sendChatAction через прокси + симуляция /menu.
 */
import { getEnvOverrides } from '../lib/settings';
import { telegramApiFetch } from '../lib/telegram-fetch';

async function timed(label: string, fn: () => Promise<void>): Promise<number> {
  const t0 = Date.now();
  await fn();
  const ms = Date.now() - t0;
  console.log(`${label}=${ms}ms`);
  return ms;
}

async function main() {
  const o = await getEnvOverrides();
  const secret = o.telegram_webhook_secret?.trim();
  const token = o.telegram_bot_token?.trim();
  if (!secret) {
    console.log('no webhook secret');
    return;
  }

  const chatId = Number(process.argv[2] || 337952743);
  const updateId = Math.floor(Date.now() / 1000);

  await timed('webhook_ack', async () => {
    const res = await fetch('https://avaterra.pro/api/portal/telegram/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': secret,
      },
      body: JSON.stringify({
        update_id: updateId,
        message: {
          message_id: updateId,
          from: { id: chatId, first_name: 'Latency' },
          chat: { id: chatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/menu',
        },
      }),
    });
    if (!res.ok) throw new Error(`webhook http ${res.status}`);
  });

  if (token) {
    await timed('sendChatAction_proxy', async () => {
      const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      });
      if (!res.ok) throw new Error(`sendChatAction http ${res.status}`);
    });
  }

  console.log('check journal: journalctl -u aletheia -n 20 --no-pager | grep telegram-webhook');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
