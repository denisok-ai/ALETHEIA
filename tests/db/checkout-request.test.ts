/**
 * Режим «оплата по заявке» (касса выключена): покупка → горячий лид в CRM +
 * уведомление владельцу (отправка в Telegram в тестах заглушена).
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { CHECKOUT_REQUEST_SOURCE, recordCheckoutRequest } from '@/lib/payments/checkout-request';

const base = { productName: '«Аватера»: Практик', amount: 25000, name: 'Анна', via: 'сайт (кнопка оплаты)' as const };

beforeEach(async () => {
  await prisma.lead.deleteMany({});
});
afterAll(async () => {
  await prisma.lead.deleteMany({});
  await prisma.$disconnect();
});

describe('checkout-request', () => {
  it('новый клиент → горячий лид с тарифом и номером заказа', async () => {
    const { leadId } = await recordCheckoutRequest({ ...base, orderNumber: 'ALT-1', email: 'anna@test.ru', phone: '+79160000001' });
    const l = await prisma.lead.findUnique({ where: { id: leadId! } });
    expect(l).toMatchObject({ status: 'qualified', source: CHECKOUT_REQUEST_SOURCE, lastOrderNumber: 'ALT-1', phone: '+79160000001' });
    expect(l?.message).toContain('Практик');
    expect(l?.message).toContain('25');
    expect(l?.buyIntentAt).not.toBeNull();
  });

  it('повторная заявка того же клиента — тот же лид, история дописывается', async () => {
    const a = await recordCheckoutRequest({ ...base, orderNumber: 'ALT-2', email: 'b@test.ru' });
    const b = await recordCheckoutRequest({ ...base, orderNumber: 'ALT-3', email: 'b@test.ru', productName: 'Пробуждение' });
    expect(b.leadId).toBe(a.leadId);
    expect(await prisma.lead.count()).toBe(1);
    const l = await prisma.lead.findUnique({ where: { id: a.leadId! } });
    expect(l?.lastOrderNumber).toBe('ALT-3');
    expect(l?.message).toContain('Практик');
    expect(l?.message).toContain('Пробуждение');
  });

  it('существующий лид из бота поднимается до qualified, оплаченный не понижается', async () => {
    const bot = await prisma.lead.create({ data: { name: 'Бот', phone: 'tg:123', email: 'c@test.ru', status: 'contacted', source: 'telegram_bot' } });
    await recordCheckoutRequest({ ...base, orderNumber: 'ALT-4', email: 'c@test.ru', phone: '+79160000002' });
    const up = await prisma.lead.findUnique({ where: { id: bot.id } });
    expect(up?.status).toBe('qualified');
    expect(up?.phone).toBe('+79160000002'); // tg-заглушка заменена реальным телефоном
    const paid = await prisma.lead.create({ data: { name: 'Оплатил', phone: '+79160000003', email: 'd@test.ru', status: 'converted' } });
    await recordCheckoutRequest({ ...base, orderNumber: 'ALT-5', email: 'd@test.ru' });
    expect((await prisma.lead.findUnique({ where: { id: paid.id } }))?.status).toBe('converted');
  });
});
