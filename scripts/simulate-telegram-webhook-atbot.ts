/** Simulate webhook with /start@BotName (menu commands from Telegram). */
import { getEnvOverrides } from '../lib/settings';

async function main() {
  const o = await getEnvOverrides();
  const secret = o.telegram_webhook_secret;
  if (!secret) throw new Error('no webhook secret');
  const text = process.argv[2] ?? '/start@AvaterraProBot';
  const res = await fetch('http://127.0.0.1:3000/api/portal/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret,
    },
    body: JSON.stringify({
      update_id: 999010,
      message: {
        message_id: 10,
        chat: { id: 1, type: 'private' },
        text,
        from: { id: 1, is_bot: false, first_name: 'Test' },
      },
    }),
  });
  const body = await res.text();
  console.log('simulate-atbot', text, 'status', res.status, body.slice(0, 180));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
