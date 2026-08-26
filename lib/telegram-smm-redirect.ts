/**
 * Секреты и отправка для «прощального» вебхука старого SMM-бота (@AvaterraBot).
 * Бот выведен из воронки: любое обращение к нему получает редирект в бота портала.
 * Токен и секрет вебхука лежат в SystemSetting в зашифрованном виде (lib/encrypt).
 */
import { prisma } from './db';
import { decrypt } from './encrypt';
import { telegramApiFetch } from './telegram-fetch';
import { TELEGRAM_BOT_URL } from './social-links';

export const SMM_TOKEN_KEY = 'telegram_smm_bot_token';
export const SMM_WEBHOOK_SECRET_KEY = 'telegram_smm_webhook_secret';
export const SMM_SETTING_CATEGORY = 'telegram_smm';

const CACHE_TTL_MS = 60_000;

type SmmSecrets = { botToken?: string; webhookSecret?: string };

let cache: { at: number; data: SmmSecrets } | null = null;

/** Сбросить кэш (после записи новых значений скриптом настройки). */
export function resetSmmSecretsCache(): void {
  cache = null;
}

export async function getSmmSecrets(): Promise<SmmSecrets> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.data;

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [SMM_TOKEN_KEY, SMM_WEBHOOK_SECRET_KEY] } },
  });
  const data: SmmSecrets = {};
  for (const row of rows) {
    if (!row.value) continue;
    let value: string;
    try {
      value = decrypt(row.value);
    } catch {
      continue; // ключ шифрования сменился — считаем, что значения нет
    }
    if (row.key === SMM_TOKEN_KEY) data.botToken = value.trim() || undefined;
    if (row.key === SMM_WEBHOOK_SECRET_KEY) data.webhookSecret = value.trim() || undefined;
  }
  cache = { at: now, data };
  return data;
}

export const SMM_REDIRECT_TEXT =
  'Здравствуйте! Школа <b>«Аватэрра»</b> переехала в основной бот — ' +
  'там курсы, материалы, поддержка и личный кабинет.\n\n' +
  'Нажмите кнопку ниже, напишите там /start — и я помогу с вопросами по курсам.';

const REDIRECT_MARKUP = {
  inline_keyboard: [[{ text: 'Перейти в бот школы', url: TELEGRAM_BOT_URL }]],
};

/** Отправить редирект токеном СТАРОГО бота (не токеном портала). */
export async function sendSmmRedirect(botToken: string, chatId: number): Promise<boolean> {
  try {
    const res = await telegramApiFetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: SMM_REDIRECT_TEXT,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: REDIRECT_MARKUP,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.error('[telegram-smm-redirect] sendMessage:', data.description ?? 'unknown');
      return false;
    }
    return true;
  } catch (e) {
    console.error('[telegram-smm-redirect] sendMessage failed', e);
    return false;
  }
}

/** Погасить «часики» на инлайн-кнопке старой воронки. */
export async function answerSmmCallback(botToken: string, callbackQueryId: string): Promise<void> {
  try {
    await telegramApiFetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch (e) {
    console.error('[telegram-smm-redirect] answerCallbackQuery failed', e);
  }
}
