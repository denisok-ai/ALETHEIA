/** One-off prod outbound Telegram API test (token from DB, not logged). */
import { getEnvOverrides } from '../lib/settings';
import { telegramApiFetch } from '../lib/telegram-fetch';

async function main() {
  const o = await getEnvOverrides();
  const token = o.telegram_bot_token;
  if (!token) {
    console.error('no token');
    process.exit(1);
  }
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '(none)';
  console.log('proxy=', proxy.replace(/:[^:@/]+@/, ':***@'));
  const res = await telegramApiFetch(https://api.telegram.org/bot/getMe);
  const body = await res.text();
  const masked = body.replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot***');
  console.log('getMe status=', res.status, masked.slice(0, 200));
  const wh = await telegramApiFetch(https://api.telegram.org/bot/getWebhookInfo);
  const whBody = await wh.text();
  const whMasked = whBody.replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot***');
  console.log('getWebhookInfo status=', wh.status, whMasked.slice(0, 300));
}
main().catch((e) => { console.error(e); process.exit(1); });
