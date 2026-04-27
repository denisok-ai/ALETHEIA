/**
 * Telegram bot helpers: send message, broadcast.
 * Токен: из БД (Портал → Настройки → Переменные окружения). Настройки вынесены в админку.
 */
import { getEnvOverrides } from './settings';

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  const overrides = await getEnvOverrides();
  const token = overrides.telegram_bot_token;
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch {
    return false;
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
