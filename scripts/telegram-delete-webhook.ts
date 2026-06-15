#!/usr/bin/env npx tsx
/** Удалить webhook Telegram (бот работает через long-polling). */
import { deleteTelegramWebhook, getTelegramWebhookInfo } from '../lib/telegram-webhook-setup';

async function main() {
  const before = await getTelegramWebhookInfo();
  console.log('before url:', before.url || '(empty)');
  const result = await deleteTelegramWebhook({ dropPendingUpdates: false });
  if (!result.ok) {
    console.error('deleteWebhook FAILED:', result.error);
    process.exit(1);
  }
  const after = await getTelegramWebhookInfo();
  console.log('after url:', after.url || '(empty)');
  console.log('pending:', after.pending_update_count ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
