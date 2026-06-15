/**
 * @deprecated Гибридный webhook+fallback заменён на lib/telegram-long-poll.ts (primary transport).
 * Оставлен для совместимости одноразовых скриптов — делегирует один цикл long-poll.
 */
import {
  prepareTelegramLongPollWorker,
  runTelegramLongPollCycle,
  type LongPollCycleResult,
} from './telegram-long-poll';

export type PollWorkerResult = {
  action: 'poll' | 'error';
  processed: number;
  received?: number;
  error?: string;
};

/** @deprecated Используйте runTelegramLongPollCycle из telegram-long-poll. */
export async function runTelegramPollFallback(): Promise<PollWorkerResult> {
  try {
    const startup = await prepareTelegramLongPollWorker();
    const result: LongPollCycleResult = await runTelegramLongPollCycle(startup.initialOffset);
    if (result.error) {
      return { action: 'error', processed: result.processed, error: result.error };
    }
    return {
      action: 'poll',
      processed: result.processed,
      received: result.received,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { action: 'error', processed: 0, error: msg };
  }
}
