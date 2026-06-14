#!/usr/bin/env npx tsx
/**
 * Непрерывный poll-fallback: 2s при сбое webhook, 10s когда webhook здоров.
 * systemd: aletheia-telegram-poll.service
 */
import { runTelegramPollFallback } from '../lib/telegram-poll-fallback';

const INTERVAL_HEALTHY_MS = 10_000;
const INTERVAL_UNHEALTHY_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`[telegram-poll-daemon] start healthy=${INTERVAL_HEALTHY_MS}ms unhealthy=${INTERVAL_UNHEALTHY_MS}ms`);
  for (;;) {
    const t0 = Date.now();
    try {
      const result = await runTelegramPollFallback();
      const delay =
        result.action === 'skip_ok' ? INTERVAL_HEALTHY_MS : INTERVAL_UNHEALTHY_MS;
      console.log(
        `[${new Date().toISOString()}] action=${result.action} processed=${result.processed}` +
          (result.pendingBefore != null ? ` pending=${result.pendingBefore}` : '') +
          ` next_in=${delay}ms loop_ms=${Date.now() - t0}`
      );
      await sleep(Math.max(0, delay - (Date.now() - t0)));
    } catch (e) {
      console.error('[telegram-poll-daemon]', e);
      await sleep(INTERVAL_UNHEALTHY_MS);
    }
  }
}

main().catch((e) => {
  console.error('[telegram-poll-daemon] fatal', e);
  process.exit(1);
});
