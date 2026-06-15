#!/usr/bin/env npx tsx
/**
 * Единственный long-polling worker Telegram-бота (systemd: aletheia-telegram-poll.service).
 */
import { runTelegramLongPollLoop } from '../lib/telegram-long-poll';

console.log('[telegram-poll-daemon] starting long-poll primary transport');

runTelegramLongPollLoop().catch((e) => {
  console.error('[telegram-poll-daemon] fatal', e);
  process.exit(1);
});
