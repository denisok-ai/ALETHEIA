/**
 * Состояние диалога Telegram-бота (поиск пользователя, написание в поддержку).
 * Хранится в SystemSetting: ключ tg_bot_session_{chatId}.
 */
import { prisma } from '@/lib/db';
import type { BotSession, BotSessionState } from './types';

const KEY_PREFIX = 'tg_bot_session_';

function sessionKey(chatId: number | string): string {
  return `${KEY_PREFIX}${chatId}`;
}

export async function getBotSession(chatId: number): Promise<BotSession> {
  const row = await prisma.systemSetting.findUnique({ where: { key: sessionKey(chatId) } });
  if (!row?.value) return { state: 'idle' };
  try {
    const parsed = JSON.parse(row.value) as BotSession;
    if (parsed?.state) return parsed;
  } catch {
    /* ignore */
  }
  return { state: 'idle' };
}

export async function setBotSession(chatId: number, session: BotSession): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: sessionKey(chatId) },
    create: { key: sessionKey(chatId), value: JSON.stringify(session), category: 'telegram_bot' },
    update: { value: JSON.stringify(session) },
  });
}

export async function clearBotSession(chatId: number): Promise<void> {
  await prisma.systemSetting.deleteMany({ where: { key: sessionKey(chatId) } });
}

export async function setSessionState(
  chatId: number,
  state: BotSessionState,
  data?: Record<string, string>
): Promise<void> {
  await setBotSession(chatId, { state, data });
}
