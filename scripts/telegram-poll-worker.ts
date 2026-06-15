#!/usr/bin/env npx tsx
/**
 * Одноразовый цикл long-poll (диагностика / cron legacy).
 */
import { prepareTelegramLongPollWorker, runTelegramLongPollCycle } from '../lib/telegram-long-poll';

async function main() {
  const startup = await prepareTelegramLongPollWorker();
  const result = await runTelegramLongPollCycle(startup.initialOffset);
  const ts = new Date().toISOString();
  console.log(
    `[${ts}] received=${result.received} processed=${result.processed} offset=${result.offset}` +
      (result.error ? ` error=${result.error}` : '')
  );
  if (result.error && result.processed === 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[telegram-poll-worker]', e);
  process.exit(1);
});
