/** getWebhookInfo через прокси (токен из БД). */
import { getEnvOverrides } from '../lib/settings';
import { telegramApiFetch } from '../lib/telegram-fetch';

async function main() {
  const o = await getEnvOverrides();
  const token = o.telegram_bot_token;
  if (!token) {
    console.log('no bot token');
    process.exit(1);
  }
  const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const data = (await res.json()) as {
    result?: { pending_update_count?: number; last_error_message?: string; url?: string };
  };
  const r = data.result ?? {};
  console.log('pending', r.pending_update_count ?? 0);
  console.log('last_error', r.last_error_message ?? '(none)');
  console.log('url', r.url ?? '(none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
