#!/usr/bin/env npx tsx
/**
 * Гибридный worker: каждые ~30s (cron) подхватывает updates через getUpdates,
 * если webhook не доставляет (Connection timed out / pending > 0).
 * VPS: scripts/telegram-poll-worker.sh
 */
import { runTelegramPollFallback } from '../lib/telegram-poll-fallback';

async function main() {
  const result = await runTelegramPollFallback();
  const ts = new Date().toISOString();
  console.log(
    `[${ts}] action=${result.action} processed=${result.processed}` +
      (result.pendingBefore != null ? ` pending_before=${result.pendingBefore}` : '') +
      (result.lastError ? ` last_error=${result.lastError.replace(/\s+/g, '_')}` : '') +
      (result.error ? ` error=${result.error}` : '')
  );
  if (result.action === 'error' && result.processed === 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[telegram-poll-worker]', e);
  process.exit(1);
});
