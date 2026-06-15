#!/usr/bin/env npx tsx
/** CLI: удалить webhook и зарегистрировать команды (режим long-polling). */
import { registerTelegramBotCommands } from '../lib/telegram-bot/commands';
import { deleteTelegramWebhook, getTelegramWebhookInfo } from '../lib/telegram-webhook-setup';

async function main() {
  const infoBefore = await getTelegramWebhookInfo();
  console.log('webhook before:', infoBefore.url || '(empty)');

  const deleted = await deleteTelegramWebhook({ dropPendingUpdates: false });
  if (!deleted.ok) {
    console.error('deleteWebhook FAILED:', deleted.error);
    process.exit(1);
  }

  const commands = await registerTelegramBotCommands();
  if (!commands.ok) {
    console.error('setMyCommands FAILED:', commands.error);
    process.exit(1);
  }
  console.log('setMyCommands ok, user commands:', commands.count);

  const info = await getTelegramWebhookInfo();
  console.log('webhook after:', info.url || '(empty)');
  console.log('pending:', info.pending_update_count ?? 0);
  console.log('Restart poll worker: sudo systemctl restart aletheia-telegram-poll.service');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
