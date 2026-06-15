/**
 * Telegram bot helpers: send message, broadcast, keyboards, callbacks.
 * Токен: из БД (Портал → Настройки → Переменные окружения). Настройки вынесены в админку.
 * Исходящие вызовы API: см. `telegramApiFetch` (HTTPS_PROXY при блокировке api.telegram.org).
 *
 * setMyCommands (BotFather или API):
 * start, menu, help, progress, cert, ticket_status, myid, admin_on,
 * admin, stats, tickets, orders, users, notify_test
 */
import { getEnvOverrides } from './settings';
import { telegramApiFetch } from './telegram-fetch';

export type TelegramSendResult = { ok: true } | { ok: false; error: string };

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

export type TelegramReplyMarkup = {
  inline_keyboard?: InlineKeyboardButton[][];
  keyboard?: { text: string }[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

export type SendTelegramMessageOptions = {
  parseMode?: 'HTML' | 'Markdown';
  replyMarkup?: TelegramReplyMarkup;
  disableWebPagePreview?: boolean;
};

async function getBotToken(): Promise<string | null> {
  const overrides = await getEnvOverrides();
  return overrides.telegram_bot_token ?? null;
}

async function telegramBotApi<T = unknown>(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: true; result?: T } | { ok: false; error: string }> {
  const token = await getBotToken();
  if (!token) {
    return { ok: false, error: 'Не настроен токен Telegram-бота' };
  }
  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: T;
    };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: String(data.description ?? res.statusText ?? 'Telegram API error') };
    }
    return { ok: true, result: data.result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Исключение Telegram' };
  }
}

export async function sendTelegramMessageWithResult(
  chatId: string | number,
  text: string,
  options?: SendTelegramMessageOptions
): Promise<TelegramSendResult> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode ?? 'HTML',
  };
  if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
  if (options?.disableWebPagePreview) body.disable_web_page_preview = true;
  const r = await telegramBotApi('sendMessage', body);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Отправка фото в канал или чат (URL или file_id). */
export async function sendTelegramPhotoWithResult(
  chatId: string | number,
  photo: string,
  options?: { caption?: string; parseMode?: 'HTML' | 'Markdown' }
): Promise<TelegramSendResult & { messageId?: number }> {
  const body: Record<string, unknown> = { chat_id: chatId, photo };
  if (options?.caption) {
    body.caption = options.caption;
    body.parse_mode = options.parseMode ?? 'HTML';
  }
  const r = await telegramBotApi<{ message_id?: number }>('sendPhoto', body);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, messageId: r.result?.message_id };
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<TelegramSendResult> {
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  const r = await telegramBotApi('answerCallbackQuery', body);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  const r = await sendTelegramMessageWithResult(chatId, text);
  return r.ok;
}

/** Индикатор «печатает…» — fire-and-forget для снижения perceived latency. */
export async function sendChatAction(
  chatId: string | number,
  action: 'typing' | 'upload_photo' = 'typing'
): Promise<void> {
  const token = await getBotToken();
  if (!token) return;
  try {
    await telegramApiFetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    /* non-fatal */
  }
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

export async function editTelegramMessageWithResult(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: SendTelegramMessageOptions
): Promise<TelegramSendResult> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options?.parseMode ?? 'HTML',
  };
  if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
  if (options?.disableWebPagePreview) body.disable_web_page_preview = true;
  const r = await telegramBotApi('editMessageText', body);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

let cachedBotUsername: string | null | undefined;

/** Username бота из getMe (кэш в памяти процесса). */
export async function getTelegramBotUsername(): Promise<string | null> {
  if (cachedBotUsername !== undefined) return cachedBotUsername;
  const token = await getBotToken();
  if (!token) {
    cachedBotUsername = null;
    return null;
  }
  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { ok?: boolean; result?: { username?: string } };
    cachedBotUsername = data.ok && data.result?.username ? data.result.username : null;
  } catch {
    cachedBotUsername = null;
  }
  return cachedBotUsername;
}
