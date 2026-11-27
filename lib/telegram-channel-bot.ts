/**
 * Каким ботом публиковать в Telegram-канал школы.
 *
 * 27.11.2026: основной бот @AvaterraProBot не может стать админом @avaterrapro —
 * права добавлять админов есть только у владельца канала (не у владельца сайта).
 * Админом с правом публикации там уже состоит @AvaterraBot, его токен хранится на
 * сайте (telegram_smm_bot_token — редирект в @AvaterraProBot, lib/telegram-smm-redirect.ts).
 *
 * SystemSetting `telegram_channel_bot`: 'smm' — публиковать в канал через @AvaterraBot,
 * иначе (по умолчанию, 'main') — основным ботом, как раньше. Касается ТОЛЬКО публикаций
 * в канал (анонсы статей, публикатор контента, коннектор соцсетей); личные сообщения,
 * превью админам и оповещения остаются у основного бота.
 */
import { prisma } from '@/lib/db';
import { getSmmSecrets } from '@/lib/telegram-smm-redirect';

export const CHANNEL_BOT_KEY = 'telegram_channel_bot';

export type ChannelBotChoice = 'main' | 'smm';

export function parseChannelBotChoice(value: string | null | undefined): ChannelBotChoice {
  return value?.trim().toLowerCase() === 'smm' ? 'smm' : 'main';
}

/**
 * Чистая логика выбора: при 'smm' — токен @AvaterraBot, если он есть; иначе основной.
 * Возвращает undefined, когда публиковать надо основным ботом (вызывающий код берёт свой токен).
 */
export function pickChannelBotToken(choice: ChannelBotChoice, smmToken: string | undefined): string | undefined {
  if (choice === 'smm' && smmToken?.trim()) return smmToken.trim();
  return undefined;
}

/** Токен для публикации в канал или undefined — «публикуй основным ботом». */
export async function getChannelBotToken(): Promise<string | undefined> {
  const row = await prisma.systemSetting.findUnique({ where: { key: CHANNEL_BOT_KEY } }).catch(() => null);
  const choice = parseChannelBotChoice(row?.value);
  if (choice === 'main') return undefined;
  const { botToken } = await getSmmSecrets();
  return pickChannelBotToken(choice, botToken);
}
