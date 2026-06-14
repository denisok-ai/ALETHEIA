/**
 * Регистрация и диагностика webhook Telegram Bot API.
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

/** Зарегистрировать webhook на URL приложения. */
export async function registerTelegramWebhook(): Promise<TelegramWebhookInfo & { webhookUrl?: string }> {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return { ok: false, error: 'Не настроен токен Telegram-бота' };

  const settings = await getSystemSettings();
  const siteUrl = (settings.site_url || process.env.NEXT_PUBLIC_URL || '').replace(/\/$/, '');
  if (!siteUrl.startsWith('https://')) {
    return { ok: false, error: 'Для webhook нужен публичный HTTPS URL сайта (site_url в настройках)' };
  }

  const webhookUrl = `${siteUrl}/api/portal/telegram/webhook`;
  const secret = overrides.telegram_webhook_secret?.trim();

  const body: Record<string, string> = { url: webhookUrl };
  if (secret) body.secret_token = secret;

  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: String(data.description ?? res.statusText ?? 'setWebhook failed') };
    }
    const info = await getTelegramWebhookInfo();
    return { ...info, webhookUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Ошибка setWebhook' };
  }
}
