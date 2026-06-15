/**
 * Основной транспорт Telegram-бота: long-polling getUpdates (без webhook).
 * Один worker на VPS (systemd aletheia-telegram-poll.service).
 */
import fs from 'node:fs';
import path from 'node:path';
import { routeTelegramUpdate } from './telegram-bot/router';
import type { TelegramUpdate } from './telegram-bot/types';
import { registerTelegramBotCommands } from './telegram-bot/commands';
import { telegramApiFetch } from './telegram-fetch';
import { getEnvOverrides } from './settings';
import { deleteTelegramWebhook, getTelegramWebhookInfo } from './telegram-webhook-setup';

const STATE_DIR = process.env.TELEGRAM_POLL_STATE_DIR?.trim() || '/var/lib/aletheia';
const STATE_FILE = path.join(STATE_DIR, 'telegram-poll-offset.json');

/** Long-poll timeout (сек) — Telegram держит соединение до этого времени. */
export const TELEGRAM_LONG_POLL_TIMEOUT_SEC = 30;
/** HTTP timeout для getUpdates: дольше long-poll + запас на прокси. */
export const TELEGRAM_GET_UPDATES_HTTP_TIMEOUT_MS =
  (TELEGRAM_LONG_POLL_TIMEOUT_SEC + 15) * 1000;

const ALLOWED_UPDATES = ['message', 'callback_query'] as const;

type PollState = { offset: number; updatedAt: string };

export type LongPollStartupResult = {
  webhookDeleted: boolean;
  commandsRegistered: boolean;
  commandsError?: string;
  initialOffset: number;
};

function loadState(): PollState {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PollState>;
    return {
      offset: typeof parsed.offset === 'number' ? parsed.offset : 0,
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch {
    return { offset: 0, updatedAt: '' };
  }
}

function saveState(offset: number): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ offset, updatedAt: new Date().toISOString() }, null, 0),
      'utf8'
    );
  } catch (e) {
    console.warn('[telegram-poll] state save failed', e);
  }
}

async function botToken(): Promise<string | undefined> {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  const overrides = await getEnvOverrides();
  return overrides.telegram_bot_token?.trim() || undefined;
}

function describeUpdate(update: TelegramUpdate): string {
  const cmd =
    update.message?.text?.split(/\s/)[0] ??
    update.callback_query?.data?.split(':')[0] ??
    '';
  return cmd.slice(0, 40);
}

async function fetchUpdatesLongPoll(token: string, offset: number): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', '100');
  url.searchParams.set('timeout', String(TELEGRAM_LONG_POLL_TIMEOUT_SEC));
  for (const kind of ALLOWED_UPDATES) {
    url.searchParams.append('allowed_updates[]', kind);
  }

  const res = await telegramApiFetch(url.toString(), {
    signal: AbortSignal.timeout(TELEGRAM_GET_UPDATES_HTTP_TIMEOUT_MS),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    description?: string;
    error_code?: number;
    result?: TelegramUpdate[];
  };

  if (!data.ok) {
    const err = new Error(String(data.description ?? 'getUpdates failed')) as Error & {
      errorCode?: number;
    };
    err.errorCode = data.error_code;
    throw err;
  }

  return Array.isArray(data.result) ? data.result : [];
}

/** Старт worker: удалить webhook, зарегистрировать команды, загрузить offset. */
export async function prepareTelegramLongPollWorker(): Promise<LongPollStartupResult> {
  const token = await botToken();
  if (!token) {
    throw new Error('no TELEGRAM_BOT_TOKEN');
  }

  const info = await getTelegramWebhookInfo();
  let webhookDeleted = true;
  if (info.ok && info.url) {
    const deleted = await deleteTelegramWebhook({ dropPendingUpdates: false });
    webhookDeleted = deleted.ok;
    if (!deleted.ok) {
      console.error('[telegram-poll] deleteWebhook failed:', deleted.error);
    } else {
      console.log('[telegram-poll] webhook deleted (was:', info.url, ')');
    }
  } else {
    console.log('[telegram-poll] webhook already empty');
  }

  const commands = await registerTelegramBotCommands();
  if (!commands.ok) {
    console.warn('[telegram-poll] setMyCommands failed:', commands.error);
  } else {
    console.log(`[telegram-poll] setMyCommands ok count=${commands.count}`);
  }

  const offset = loadState().offset;
  console.log(`[telegram-poll] offset=${offset} long_poll=${TELEGRAM_LONG_POLL_TIMEOUT_SEC}s`);

  return {
    webhookDeleted,
    commandsRegistered: commands.ok,
    commandsError: commands.ok ? undefined : commands.error,
    initialOffset: offset,
  };
}

export type LongPollCycleResult = {
  received: number;
  processed: number;
  offset: number;
  conflict: boolean;
  error?: string;
};

/** Один цикл long-poll: getUpdates → routeTelegramUpdate для каждого update. */
export async function runTelegramLongPollCycle(offset: number): Promise<LongPollCycleResult> {
  const token = await botToken();
  if (!token) {
    return { received: 0, processed: 0, offset, error: 'no TELEGRAM_BOT_TOKEN', conflict: false };
  }

  let updates: TelegramUpdate[];
  try {
    updates = await fetchUpdatesLongPoll(token, offset);
  } catch (e) {
    const err = e as Error & { errorCode?: number };
    const msg = err instanceof Error ? err.message : String(e);
    const conflict = err.errorCode === 409 || /409|conflict/i.test(msg);
    return { received: 0, processed: 0, offset, error: msg, conflict };
  }

  if (!updates.length) {
    return { received: 0, processed: 0, offset, conflict: false };
  }

  let processed = 0;
  let nextOffset = offset;

  for (const update of updates) {
    const t0 = Date.now();
    const preview = describeUpdate(update);
    try {
      await routeTelegramUpdate(update);
      processed++;
      console.log(
        `[telegram-poll] update=${update.update_id} cmd=${preview || '-'} ms=${Date.now() - t0}`
      );
    } catch (e) {
      console.error(
        `[telegram-poll] route failed update=${update.update_id} cmd=${preview}:`,
        e instanceof Error ? e.message : e
      );
    }
    nextOffset = update.update_id + 1;
  }

  saveState(nextOffset);
  return { received: updates.length, processed, offset: nextOffset, conflict: false };
}

/** Бесконечный цикл long-polling (для systemd daemon). */
export async function runTelegramLongPollLoop(): Promise<never> {
  const startup = await prepareTelegramLongPollWorker();
  let offset = startup.initialOffset;
  let backoffMs = 1_000;

  for (;;) {
    const result = await runTelegramLongPollCycle(offset);
    if (result.error) {
      if (result.conflict) {
        console.error(
          '[telegram-poll] 409 Conflict — другой getUpdates? backoff',
          result.error
        );
        await sleep(Math.min(backoffMs, 60_000));
        backoffMs = Math.min(backoffMs * 2, 60_000);
        continue;
      }
      console.error('[telegram-poll] cycle error:', result.error);
      await sleep(Math.min(backoffMs, 30_000));
      backoffMs = Math.min(backoffMs * 2, 30_000);
      continue;
    }

    backoffMs = 1_000;
    offset = result.offset;
    if (result.received === 0) {
      continue;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
