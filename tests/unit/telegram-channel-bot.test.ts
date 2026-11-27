/**
 * Выбор бота для публикации в Telegram-канал (27.11.2026): основной бот не может
 * стать админом @avaterrapro, публикуем через @AvaterraBot по настройке telegram_channel_bot.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const getSmmSecrets = vi.fn();
vi.mock('@/lib/db', () => ({ prisma: { systemSetting: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
vi.mock('@/lib/telegram-smm-redirect', () => ({ getSmmSecrets: () => getSmmSecrets() }));

import { getChannelBotToken, parseChannelBotChoice, pickChannelBotToken } from '@/lib/telegram-channel-bot';

describe('telegram-channel-bot: выбор', () => {
  it('по умолчанию и при мусоре — основной бот', () => {
    expect(parseChannelBotChoice(undefined)).toBe('main');
    expect(parseChannelBotChoice('')).toBe('main');
    expect(parseChannelBotChoice('pro')).toBe('main');
    expect(parseChannelBotChoice(' SMM ')).toBe('smm');
  });

  it('smm с токеном — его токен; без токена — откат на основной (undefined)', () => {
    expect(pickChannelBotToken('smm', ' 123:abc ')).toBe('123:abc');
    expect(pickChannelBotToken('smm', undefined)).toBeUndefined();
    expect(pickChannelBotToken('smm', '  ')).toBeUndefined();
    expect(pickChannelBotToken('main', '123:abc')).toBeUndefined();
  });
});

describe('telegram-channel-bot: из настроек', () => {
  beforeEach(() => {
    findUnique.mockReset();
    getSmmSecrets.mockReset();
  });

  it('настройка не задана — основной бот, секреты SMM даже не читаются', async () => {
    findUnique.mockResolvedValue(null);
    expect(await getChannelBotToken()).toBeUndefined();
    expect(getSmmSecrets).not.toHaveBeenCalled();
  });

  it('smm — токен @AvaterraBot', async () => {
    findUnique.mockResolvedValue({ value: 'smm' });
    getSmmSecrets.mockResolvedValue({ botToken: '999:xyz' });
    expect(await getChannelBotToken()).toBe('999:xyz');
  });

  it('ошибка чтения настройки — основной бот, а не падение публикации', async () => {
    findUnique.mockRejectedValue(new Error('db locked'));
    expect(await getChannelBotToken()).toBeUndefined();
  });
});
