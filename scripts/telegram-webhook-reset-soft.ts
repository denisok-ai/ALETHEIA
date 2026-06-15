#!/usr/bin/env npx tsx
/** @deprecated Webhook сброс отключён — бот на long-polling. */
import { deleteTelegramWebhook, getTelegramWebhookInfo } from '../lib/telegram-webhook-setup';

async function main() {
  const info = await getTelegramWebhookInfo();
  console.log('mode=polling pending', info.pending_update_count, 'url', info.url || '(empty)');
  if (info.url) {
    const result = await deleteTelegramWebhook({ dropPendingUpdates: false });
    console.log('deleteWebhook', result.ok ? 'ok' : result.error);
  } else {
    console.log('webhook already empty — no action');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
