#!/usr/bin/env npx tsx
/**
 * CLI: зарегистрировать webhook Telegram на проде или локально.
 * Запуск на VPS: cd /opt/ALETHEIA && npx tsx scripts/setup-telegram-webhook.ts
 */
import { registerTelegramWebhook, getTelegramWebhookInfo } from '../lib/telegram-webhook-setup';

async function main() {
  console.log('=== Telegram webhook setup ===');
  const before = await getTelegramWebhookInfo();
  if (before.ok) {
    console.log('Текущий webhook:', before.url || '(не задан)');
    if (before.last_error_message) console.log('Последняя ошибка:', before.last_error_message);
  } else {
    console.log('getWebhookInfo:', before.error);
  }

  const result = await registerTelegramWebhook();
  if (!result.ok) {
    console.error('setWebhook FAILED:', result.error);
    process.exit(1);
  }
  console.log('OK — webhook:', result.webhookUrl);
  console.log('pending updates:', result.pending_update_count ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
