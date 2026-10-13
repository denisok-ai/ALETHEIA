/**
 * Правило первого касания для Lead.acqRef в боте: метка из /start ?ref= пишется,
 * только если у лида поле пустое. БД мокаем.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, findFirst, update, create } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(async () => ({})),
  create: vi.fn(async () => ({ id: 99 })),
}));
vi.mock('@/lib/db', () => ({ prisma: { lead: { findUnique, findFirst, update, create } } }));

import { upsertBotLead } from '@/lib/telegram-bot/lead-service';
import type { BotContext } from '@/lib/telegram-bot/types';

const ctx = { chatId: 555, telegramUsername: 'student', displayName: 'Анна' } as unknown as BotContext;

beforeEach(() => {
  vi.clearAllMocks();
});

function updateData(): Record<string, unknown> {
  return (update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
}

function createData(): Record<string, unknown> {
  return (create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
}

describe('upsertBotLead: acqRef по правилу первого касания', () => {
  it('лид с сайта без метки получает tg-01 из deep link', async () => {
    findUnique.mockResolvedValueOnce({ id: 7, acqRef: null, message: null, phone: '+79990000000' });
    await upsertBotLead(ctx, { bindLeadId: 7, entrySource: 'faq', acqRef: 'tg-01' });
    expect(updateData()).toMatchObject({ acqRef: 'tg-01' });
  });

  it('уже сохранённая метка не перезаписывается', async () => {
    findUnique.mockResolvedValueOnce({ id: 7, acqRef: 'vk-03', message: null, phone: '+79990000000' });
    await upsertBotLead(ctx, { bindLeadId: 7, entrySource: 'faq', acqRef: 'tg-01' });
    expect(updateData()).not.toHaveProperty('acqRef');
  });

  it('повторный /start без метки не трогает существующую acqRef', async () => {
    findFirst.mockResolvedValueOnce({ id: 8, acqRef: 'yt-02', message: null, phone: '@student' });
    await upsertBotLead(ctx, { entrySource: 'blog' });
    expect(updateData()).not.toHaveProperty('acqRef');
  });

  it('новый лид бота создаётся с меткой', async () => {
    findFirst.mockResolvedValueOnce(null);
    await upsertBotLead(ctx, { entrySource: 'chat', acqRef: 'tg-01' });
    expect(createData()).toMatchObject({ acqRef: 'tg-01', source: 'telegram_bot' });
  });

  it('новый лид без метки пишет acqRef = null', async () => {
    findFirst.mockResolvedValueOnce(null);
    await upsertBotLead(ctx, { entrySource: 'chat' });
    expect(createData()).toMatchObject({ acqRef: null });
  });

  it('невалидная метка не попадает в лид', async () => {
    findFirst.mockResolvedValueOnce(null);
    await upsertBotLead(ctx, { entrySource: 'chat', acqRef: 'tg-1' });
    expect(createData()).toMatchObject({ acqRef: null });
  });
});
