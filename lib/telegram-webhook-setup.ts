/**
 * Диагностика webhook Telegram Bot API и legacy setWebhook (бот на проде — long-polling).
 */
import { getEnvOverrides, getSystemSettings } from './settings';
import { telegramApiFetch } from './telegram-fetch';

export type TelegramWebhookInfo = {
  ok: boolean;
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  ip_address?: string;
  error?: string;
};

export async function getTelegramWebhookInfo(): Promise<TelegramWebhookInfo> {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return { ok: false, error: 'Не настроен токен Telegram-бота' };

  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data = (await res.json()) as {
      ok?: boolean;
      description?: string;
      result?: Record<string, unknown>;
    };
    if (!data.ok) {
      return { ok: false, error: String(data.description ?? 'Telegram API error') };
    }
    const r = data.result ?? {};
    return {
      ok: true,
      url: typeof r.url === 'string' ? r.url : '',
      has_custom_certificate: r.has_custom_certificate === true,
      pending_update_count: typeof r.pending_update_count === 'number' ? r.pending_update_count : 0,
      last_error_date: typeof r.last_error_date === 'number' ? r.last_error_date : undefined,
      last_error_message: typeof r.last_error_message === 'string' ? r.last_error_message : undefined,
      max_connections: typeof r.max_connections === 'number' ? r.max_connections : undefined,
      ip_address: typeof r.ip_address === 'string' ? r.ip_address : undefined,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка запроса к Telegram' };
  }
}

export type DeleteTelegramWebhookOptions = {
  dropPendingUpdates?: boolean;
};

/** Удалить webhook (основной режим бота — long-polling). */
export async function deleteTelegramWebhook(
  options: DeleteTelegramWebhookOptions = {}
): Promise<{ ok: boolean; error?: string }> {
  const dropPendingUpdates = options.dropPendingUpdates === true;
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return { ok: false, error: 'Не настроен токен Telegram-бота' };

  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: dropPendingUpdates }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: String(data.description ?? res.statusText ?? 'deleteWebhook failed') };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка deleteWebhook' };
  }
}

export type RegisterTelegramWebhookOptions = {
  /** @deprecated Бот на проде использует long-polling; вызывает deleteWebhook. */
  dropPendingUpdates?: boolean;
};

/** @deprecated Используйте deleteTelegramWebhook + systemd poll worker. */
export async function registerTelegramWebhook(
  options: RegisterTelegramWebhookOptions = {}
): Promise<TelegramWebhookInfo & { webhookUrl?: string; deprecated?: boolean }> {
  const deleted = await deleteTelegramWebhook({
    dropPendingUpdates: options.dropPendingUpdates === true,
  });
  if (!deleted.ok) {
    return { ok: false, error: deleted.error ?? 'deleteWebhook failed' };
  }
  const info = await getTelegramWebhookInfo();
  return { ...info, deprecated: true };
}
