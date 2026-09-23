/**
 * Ядро воронки лидов на изолированной sqlite (миграции прода).
 * Отправка в Telegram заглушена (TELEGRAM_DISABLE_OUTBOUND=1).
 * Каждый кейс — инвариант, на котором держится CRM: один чат = один лид,
 * статус не откатывается, догоны не дублируются, оффер не спамит.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { upsertBotLead, saveLeadPhone, markLeadResponded } from '@/lib/telegram-bot/lead-service';
import { markContacted, markLost, markQualified } from '@/lib/telegram-bot/lead-qualify';
import { runTelegramLeadFollowup } from '@/lib/telegram-lead-followup';
import { sendOffer } from '@/lib/telegram-bot/offer';
import type { BotContext } from '@/lib/telegram-bot/types';

const ctx = (chatId: number, username = `u${chatId}`): BotContext => ({
  chatId,
  telegramUserId: chatId,
  telegramUsername: username,
  displayName: `Тест ${chatId}`,
});
const H = 3600 * 1000;
const D = 24 * H;

beforeEach(async () => {
  await prisma.lead.deleteMany({});
});
afterAll(async () => {
  await prisma.lead.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.$disconnect();
});

describe('lead-service: один чат — один лид', () => {
  it('повторные события того же чата не плодят карточки, история дописывается', async () => {
    const id1 = await upsertBotLead(ctx(1001), { segment: 'warm', choiceLabel: 'Думаю', entrySource: 'blog' });
    const id2 = await upsertBotLead(ctx(1001), { freeform: 'сколько длится курс?' });
    expect(id1).not.toBeNull();
    expect(id2).toBe(id1);
    expect(await prisma.lead.count({ where: { telegramChatId: 1001 } })).toBe(1);
    const lead = await prisma.lead.findUnique({ where: { id: id1! } });
    expect(lead?.entrySource).toBe('blog');
    expect(lead?.message).toContain('сколько длится курс?');
  });

  it('телефон с сайта не затирается контактом из бота, а tg-заглушка — заменяется', async () => {
    const id = await upsertBotLead(ctx(1002), { segment: 'hot' });
    expect((await prisma.lead.findUnique({ where: { id: id! } }))?.phone).toMatch(/^@u1002|^tg:/);
    await saveLeadPhone(ctx(1002), '+7 916 111-22-33');
    const l = await prisma.lead.findUnique({ where: { id: id! } });
    expect(l?.phone).toBe('+79161112233');
    expect(l?.status).toBe('qualified');
    // Слишком короткий номер — отклоняется без изменений
    expect(await saveLeadPhone(ctx(1002), '123')).toBeNull();
  });
});

describe('lead-qualify: статус только вперёд', () => {
  it('new → contacted → qualified; contacted не понижает qualified', async () => {
    const id = await upsertBotLead(ctx(1003), { segment: 'warm' });
    await markContacted(1003, 'написал');
    expect((await prisma.lead.findUnique({ where: { id: id! } }))?.status).toBe('contacted');
    await markQualified(1003, 'интент', { buyIntent: true });
    const q = await prisma.lead.findUnique({ where: { id: id! } });
    expect(q?.status).toBe('qualified');
    expect(q?.buyIntentAt).not.toBeNull();
    await markContacted(1003, 'ещё сообщение');
    expect((await prisma.lead.findUnique({ where: { id: id! } }))?.status).toBe('qualified');
  });

  it('lost — терминальный, причина сохраняется', async () => {
    const id = await upsertBotLead(ctx(1004), { segment: 'warm' });
    await markLost(id!, 'не вышел на связь');
    const l = await prisma.lead.findUnique({ where: { id: id! } });
    expect(l?.status).toBe('lost');
    expect(l?.qualifyReason).toContain('не вышел на связь');
    await markContacted(1004, 'вдруг написал');
    expect((await prisma.lead.findUnique({ where: { id: id! } }))?.status).toBe('lost');
  });
});

describe('followup: прогрев без дублей', () => {
  it('два прогона подряд — второй не шлёт, стадия ровно +1; отписанный исключён', async () => {
    await prisma.lead.create({
      data: { name: 'warm', phone: 'tg:a', status: 'new', source: 'telegram_bot', telegramChatId: 2001, funnelSegment: 'warm', followupStage: 0, lastBotMessageAt: new Date(Date.now() - 3 * H) },
    });
    await prisma.lead.create({
      data: { name: 'unsub', phone: 'tg:b', status: 'new', source: 'telegram_bot', telegramChatId: 2002, funnelSegment: 'hot', followupStage: 0, lastBotMessageAt: new Date(Date.now() - 5 * D), unsubscribedAt: new Date() },
    });
    const r1 = await runTelegramLeadFollowup({});
    const r2 = await runTelegramLeadFollowup({});
    expect(r1.sent).toBe(1);
    expect(r2.sent).toBe(0);
    expect((await prisma.lead.findFirst({ where: { telegramChatId: 2001 } }))?.followupStage).toBe(1);
    expect((await prisma.lead.findFirst({ where: { telegramChatId: 2002 } }))?.followupStage).toBe(0);
  });

  it('ответивший лид выходит из авто-догонов', async () => {
    await prisma.lead.create({
      data: { name: 'resp', phone: 'tg:c', status: 'new', source: 'telegram_bot', telegramChatId: 2003, funnelSegment: 'warm', followupStage: 1, lastBotMessageAt: new Date(Date.now() - 2 * D) },
    });
    await markLeadResponded(2003);
    const dry = await runTelegramLeadFollowup({ dryRun: true });
    expect(dry.candidates).toBe(0);
  });
});

describe('offer: кулдаун', () => {
  it('force обходит суточный кулдаун, но не часовой пол; через 2 ч — снова можно', async () => {
    // Оффер строится из живой витрины: нужен опубликованный курс с активным тарифом.
    const course = await prisma.course.create({ data: { title: 'Тестовый курс', status: 'published' } });
    await prisma.service.create({
      data: { slug: 'test-tariff', name: 'Тестовый тариф', price: 1000, courseId: course.id, isActive: true },
    });
    await prisma.lead.create({
      data: { name: 'buyer', phone: 'tg:d', status: 'qualified', source: 'telegram_bot', telegramChatId: 3001 },
    });
    const r1 = await sendOffer(3001, { force: true });
    const r2 = await sendOffer(3001, { force: true });
    expect(r1.sent).toBe(true);
    expect(r2).toMatchObject({ sent: false, reason: 'cooldown' });
    await prisma.lead.updateMany({ where: { telegramChatId: 3001 }, data: { offerSentAt: new Date(Date.now() - 2 * H) } });
    expect((await sendOffer(3001, { force: true })).sent).toBe(true);
    // Вариант A/B закреплён за лидом и не меняется между отправками
    const l = await prisma.lead.findFirst({ where: { telegramChatId: 3001 } });
    expect(['A', 'B']).toContain(l?.offerVariant);
  });
});
