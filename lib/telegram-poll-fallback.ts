/**
 * Гибридный fallback: при сбое webhook (timeout / pending) — getUpdates + routeTelegramUpdate.
 * Webhook остаётся основным каналом; polling подхватывает пропущенные обновления.
 */
import fs from 'node:fs';
import path from 'node:path';
import { routeTelegramUpdate } from './telegram-bot/router';
import type { TelegramUpdate } from './telegram-bot/types';
import { telegramApiFetch } from './telegram-fetch';
import {
  getTelegramWebhookInfo,
  registerTelegramWebhook,
  type TelegramWebhookInfo,
} from './telegram-webhook-setup';
import { getEnvOverrides } from './settings';

const STATE_DIR = process.env.TELEGRAM_POLL_STATE_DIR?.trim() || '/var/lib/aletheia';
const STATE_FILE = path.join(STATE_DIR, 'telegram-poll-offset.json');

type PollState = { offset: number; updatedAt: string };

export type PollWorkerResult = {
  action: 'skip_ok' | 'fallback_poll' | 'error';
  processed: number;
  pendingBefore?: number;
  lastError?: string;
  error?: string;
};

function loadState(): PollState {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PollState>;
    return { offset: typeof parsed.offset === 'number' ? parsed.offset : 0, updatedAt: parsed.updatedAt ?? '' };
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

function needsFallback(info: TelegramWebhookInfo): boolean {
  const err = info.last_error_message ?? '';
  const hasDeliveryError = /timeout|timed_out|connection|wrong response|ssl|certificate/i.test(err);
  const errDate = info.last_error_date ?? 0;
  const recentError = errDate > 0 && Date.now() / 1000 - errDate < 300;

  if (hasDeliveryError && recentError) return true;

  const pending = info.pending_update_count ?? 0;
  // pending без ошибки доставки — webhook, скорее всего, работает; не трогаем (избегаем дублей)
  if (pending > 0 && (hasDeliveryError || recentError)) return true;

  return false;
}

async function botToken(): Promise<string | undefined> {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  const overrides = await getEnvOverrides();
  return overrides.telegram_bot_token?.trim() || undefined;
}

async function deleteWebhookKeepPending(token: string): Promise<boolean> {
  const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: false }),
  });
  const data = (await res.json()) as { ok?: boolean; description?: string };
  if (!data.ok) {
    console.error('[telegram-poll] deleteWebhook failed:', data.description);
    return false;
  }
  return true;
}

async function fetchUpdates(token: string, offset: number): Promise<TelegramUpdate[]> {
  const url = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', '100');
  url.searchParams.set('timeout', '0');
  const res = await telegramApiFetch(url.toString());
  const data = (await res.json()) as { ok?: boolean; description?: string; result?: TelegramUpdate[] };
  if (!data.ok) {
    throw new Error(String(data.description ?? 'getUpdates failed'));
  }
  return Array.isArray(data.result) ? data.result : [];
}

/** Один проход fallback-worker: проверка webhook → getUpdates → восстановление webhook. */
export async function runTelegramPollFallback(): Promise<PollWorkerResult> {
  const token = await botToken();
  if (!token) {
    return { action: 'error', processed: 0, error: 'no TELEGRAM_BOT_TOKEN' };
  }

  const info = await getTelegramWebhookInfo();
  if (!info.ok) {
    return { action: 'error', processed: 0, error: info.error ?? 'getWebhookInfo failed' };
  }

  if (!needsFallback(info)) {
    return {
      action: 'skip_ok',
      processed: 0,
      pendingBefore: info.pending_update_count ?? 0,
      lastError: info.last_error_message,
    };
  }

  const pendingBefore = info.pending_update_count ?? 0;
  const lastError = info.last_error_message;
  console.log(
    `[telegram-poll] fallback start pending=${pendingBefore} last_error=${lastError ?? 'none'}`
  );

  if (!(await deleteWebhookKeepPending(token))) {
    return { action: 'error', processed: 0, error: 'deleteWebhook failed', pendingBefore, lastError };
  }

  let offset = loadState().offset;
  let processed = 0;

  try {
    for (let round = 0; round < 20; round++) {
      const updates = await fetchUpdates(token, offset);
      if (!updates.length) break;
      for (const update of updates) {
        await routeTelegramUpdate(update);
        offset = update.update_id + 1;
        processed++;
      }
    }
    saveState(offset);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[telegram-poll] getUpdates/route failed:', msg);
    await registerTelegramWebhook({ dropPendingUpdates: false }).catch(() => {});
    return { action: 'error', processed, error: msg, pendingBefore, lastError };
  }

  const restored = await registerTelegramWebhook({ dropPendingUpdates: false });
  if (!restored.ok) {
    console.error('[telegram-poll] setWebhook restore failed:', restored.error);
    return {
      action: 'error',
      processed,
      error: restored.error ?? 'setWebhook restore failed',
      pendingBefore,
      lastError,
    };
  }

  console.log(`[telegram-poll] fallback done processed=${processed} offset=${offset}`);
  return { action: 'fallback_poll', processed, pendingBefore, lastError };
}
