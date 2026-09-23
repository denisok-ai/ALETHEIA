/**
 * Сверка «оплачено, но нет доступа» (lib/payments/reconcile-enrollments.ts).
 *
 * Держит инвариант из CLAUDE.md: Order.userId проставляется ТОЛЬКО вместе с
 * созданием Enrollment. Поэтому userId=null → поток оплаты оборвался, можно
 * чинить; userId заполнен, а зачисления нет → доступ отозван намеренно,
 * автоматика его не возвращает.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { findMissingEnrollments, reconcileEnrollments, repairEnrollmentForOrder } from '@/lib/payments/reconcile-enrollments';

let courseId = '';
let n = 0;

async function paidOrder(email: string, extra: Record<string, unknown> = {}) {
  n += 1;
  return prisma.order.create({
    data: { orderNumber: `T-${n}`, tariffId: 'rec-tariff', amount: 25000, clientEmail: email, status: 'paid', paidAt: new Date(), ...extra },
  });
}
const user = (email: string) => prisma.user.create({ data: { email, passwordHash: 'x' } });
const enrolled = async (email: string) => {
  const u = await prisma.user.findUnique({ where: { email } });
  return u ? !!(await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: u.id, courseId } } })) : false;
};

beforeAll(async () => {
  const course = await prisma.course.create({ data: { title: 'Курс сверки', status: 'published' } });
  courseId = course.id;
  await prisma.service.create({ data: { slug: 'rec-tariff', name: 'Тариф сверки', price: 25000, courseId, isActive: true } });
});
beforeEach(async () => {
  await prisma.enrollment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.user.deleteMany({});
});
afterAll(async () => {
  await prisma.enrollment.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.$disconnect();
});

describe('reconcile: оплачено без доступа', () => {
  it('оборванный поток (userId пуст, пользователь есть) — чинится, userId проставляется', async () => {
    const u = await user('a@test.ru');
    const o = await paidOrder('a@test.ru');
    const r = await reconcileEnrollments({ repair: true });
    expect(r.repaired).toEqual([o.orderNumber]);
    expect(await enrolled('a@test.ru')).toBe(true);
    expect((await prisma.order.findUnique({ where: { id: o.id } }))?.userId).toBe(u.id);
    // Повторный прогон — идемпотентен
    expect((await reconcileEnrollments({ repair: true })).missing).toHaveLength(0);
  });

  it('отозванный доступ (userId заполнен, зачисления нет) — не возвращается, уходит админам', async () => {
    const u = await user('b@test.ru');
    await paidOrder('b@test.ru', { userId: u.id });
    const r = await reconcileEnrollments({ repair: true });
    expect(r.repaired).toHaveLength(0);
    expect(r.needsAttention.map((m) => m.looksRevoked)).toEqual([true]);
    expect(await enrolled('b@test.ru')).toBe(false);
    expect(await repairEnrollmentForOrder('T-' + n)).toBe(false);
  });

  it('нет аккаунта — не создаётся вслепую, уходит админам', async () => {
    await paidOrder('nobody@test.ru');
    const r = await reconcileEnrollments({ repair: true });
    expect(r.repaired).toHaveLength(0);
    expect(r.needsAttention[0]).toMatchObject({ needsUser: true, clientEmail: 'nobody@test.ru' });
  });

  it('возвращённый заказ и заказ без курса — не расхождение', async () => {
    await user('c@test.ru');
    await paidOrder('c@test.ru', { refundedAmountRub: 25000 });
    await paidOrder('c@test.ru', { tariffId: 'unknown-tariff' });
    expect((await findMissingEnrollments()).missing).toHaveLength(0);
  });

  it('repairEnrollmentForOrder чинит ровно один заказ и только оплаченный', async () => {
    await user('d@test.ru');
    const pending = await paidOrder('d@test.ru', { status: 'pending' });
    expect(await repairEnrollmentForOrder(pending.orderNumber)).toBe(false);
    const paid = await paidOrder('d@test.ru');
    expect(await repairEnrollmentForOrder(paid.orderNumber)).toBe(true);
    expect(await enrolled('d@test.ru')).toBe(true);
    expect(await repairEnrollmentForOrder(paid.orderNumber)).toBe(false);
  });
});
