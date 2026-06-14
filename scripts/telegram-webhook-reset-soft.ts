#!/usr/bin/env npx tsx
/** Мягкий reset webhook: без drop_pending (сообщения подхватит poll-worker). */
import { getTelegramWebhookInfo, registerTelegramWebhook } from '../lib/telegram-webhook-setup';

async function main() {
  const before = await getTelegramWebhookInfo();
  if (before.ok) {
    console.log('before pending', before.pending_update_count ?? 0);
    console.log('before last_error', before.last_error_message ?? '(none)');
  }
  const result = await registerTelegramWebhook({ dropPendingUpdates: false });
  if (!result.ok) {
    console.error('setWebhook FAILED:', result.error);
    process.exit(1);
  }
  console.log('OK webhook:', result.webhookUrl);
  console.log('pending:', result.pending_update_count ?? 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
