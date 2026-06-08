/**
 * Telegram bot helpers: send message, broadcast.
 * Токен: из БД (Портал → Настройки → Переменные окружения). Настройки вынесены в админку.
 * Исходящие вызовы API: см. `telegramApiFetch` (HTTPS_PROXY при блокировке api.telegram.org).
 */
import { getEnvOverrides } from './settings';
import { telegramApiFetch } from './telegram-fetch';

export type TelegramSendResult = { ok: true } | { ok: false; error: string };

export async function sendTelegramMessageWithResult(chatId: string | number, text: string): Promise<TelegramSendResult> {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) {
    return { ok: false, error: 'Не настроен токен Telegram-бота' };
  }
  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: String(data.description ?? res.statusText ?? 'Telegram API error') };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Исключение Telegram' };
  }
}

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  const r = await sendTelegramMessageWithResult(chatId, text);
  return r.ok;
}

export async function sendTelegramBroadcast(chatIds: (string | number)[], text: string): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const id of chatIds) {
    const ok = await sendTelegramMessage(id, text);
    if (ok) sent++; else failed++;
  }
  return { sent, failed };
}
