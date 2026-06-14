#!/usr/bin/env npx tsx
/**
 * CLI: зарегистрировать webhook Telegram на проде или локально.
 * Запуск на VPS: cd /opt/ALETHEIA && npx tsx scripts/setup-telegram-webhook.ts
 */
import { registerTelegramWebhook, getTelegramWebhookInfo } from '../lib/telegram-webhook-setup';
import { registerTelegramBotCommands } from '../lib/telegram-bot/commands';

async function main() {
  console.log('=== Telegram webhook setup ===');
  const before = await getTelegramWebhookInfo();
  if (before.ok) {
    console.log('Текущий webhook:', before.url || '(не задан)');
    if (before.last_error_message) console.log('Последняя ошибка:', before.last_error_message);
  } else {
    console.log('getWebhookInfo:', before.error);
  }

  const dropPending = process.argv.includes('--drop-pending');
  const result = await registerTelegramWebhook({ dropPendingUpdates: dropPending });
  if (!result.ok) {
    console.error('setWebhook FAILED:', result.error);
    process.exit(1);
  }
  console.log('OK — webhook:', result.webhookUrl);
  console.log('pending updates:', result.pending_update_count ?? 0);

  const commands = await registerTelegramBotCommands();
  if (commands.ok) {
    console.log('OK — setMyCommands:', commands.count, 'команд');
  } else {
    console.warn('setMyCommands FAILED:', commands.error);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
