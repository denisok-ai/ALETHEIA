/**
 * Срок доступа по оплате (Service.accessDays → Enrollment.expiresAt).
 *
 * Правила: создание с expiresAt = оплата + N дней; продление при повторной покупке,
 * но без укорачивания; accessDays = null → бессрочно; истёкший срок закрывает доступ.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import { hasCourseLearningAccess } from '@/lib/course-learning-access';
import { grantPaidEnrollment, isEnrollmentExpired, laterExpiry } from '@/lib/payments/enrollment-access';

const DAY = 24 * 60 * 60 * 1000;
const EMAIL = 'expiry-test@test.ru';
let courseId = '';
let n = 0;

async function cleanup() {
  await prisma.enrollment.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.order.deleteMany({ where: { clientEmail: EMAIL } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.service.deleteMany({ where: { slug: { startsWith: 'exp-test-' } } });
}

beforeEach(async () => {
  await cleanup();
  const course = await prisma.course.findFirst({ where: { title: 'Курс срока доступа (тест)' } });
  courseId = course?.id ?? (await prisma.course.create({ data: { title: 'Курс срока доступа (тест)', status: 'published' } })).id;
  await prisma.user.create({ data: { email: EMAIL, passwordHash: 'x' } });
});

afterAll(async () => {
  await cleanup();
  await prisma.course.deleteMany({ where: { title: 'Курс срока доступа (тест)' } });
  await prisma.$disconnect();
});

async function enrollmentOf() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  return prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user!.id, courseId } } });
}

/** Оплата через реальный processPaidOrder: заказ по slug товара. */
async function payService(slug: string) {
  n += 1;
  const orderNumber = `EXP-${Date.now()}-${n}`;
  await prisma.order.create({
    data: { orderNumber, tariffId: slug, amount: 5000, clientEmail: EMAIL, status: 'pending' },
  });
  const res = await processPaidOrder(orderNumber);
  expect(res.success).toBe(true);
}

async function serviceWith(slug: string, accessDays: number | null) {
  await prisma.service.create({
    data: { slug, name: 'Тест срока', price: 5000, courseId, isActive: true, accessDays },
  });
}

describe('processPaidOrder: срок доступа', () => {
  it('создаёт зачисление с expiresAt = оплата + accessDays', async () => {
    await serviceWith('exp-test-90', 90);
    const before = Date.now();
    await payService('exp-test-90');
    const e = await enrollmentOf();
    expect(e?.expiresAt).not.toBeNull();
    const delta = e!.expiresAt!.getTime() - before;
    expect(delta).toBeGreaterThan(89 * DAY);
    expect(delta).toBeLessThan(91 * DAY);
  });

  it('accessDays = null — бессрочно (expiresAt пуст)', async () => {
    await serviceWith('exp-test-forever', null);
    await payService('exp-test-forever');
    expect((await enrollmentOf())?.expiresAt).toBeNull();
  });

  it('повторная покупка продлевает короткий срок', async () => {
    await serviceWith('exp-test-ext', 90);
    const soon = new Date(Date.now() + 10 * DAY);
    await prisma.enrollment.create({
      data: { userId: (await prisma.user.findUnique({ where: { email: EMAIL } }))!.id, courseId, expiresAt: soon },
    });
    await payService('exp-test-ext');
    expect((await enrollmentOf())!.expiresAt!.getTime()).toBeGreaterThan(soon.getTime() + 60 * DAY);
  });

  it('повторная покупка не укорачивает более длинный срок', async () => {
    await serviceWith('exp-test-keep', 90);
    const far = new Date(Date.now() + 365 * DAY);
    await prisma.enrollment.create({
      data: { userId: (await prisma.user.findUnique({ where: { email: EMAIL } }))!.id, courseId, expiresAt: far },
    });
    await payService('exp-test-keep');
    expect((await enrollmentOf())!.expiresAt!.getTime()).toBe(far.getTime());
  });

  it('бессрочный доступ не сужается покупкой с ограниченным сроком', async () => {
    await serviceWith('exp-test-unl', 90);
    await prisma.enrollment.create({
      data: { userId: (await prisma.user.findUnique({ where: { email: EMAIL } }))!.id, courseId, expiresAt: null },
    });
    await payService('exp-test-unl');
    expect((await enrollmentOf())!.expiresAt).toBeNull();
  });
});

describe('grantPaidEnrollment / laterExpiry (чистая логика на БД)', () => {
  it('null побеждает любую дату, иначе берётся более поздняя', () => {
    const a = new Date('2030-01-01T00:00:00Z');
    const b = new Date('2031-01-01T00:00:00Z');
    expect(laterExpiry(null, a)).toBeNull();
    expect(laterExpiry(a, null)).toBeNull();
    expect(laterExpiry(a, b)).toBe(b);
    expect(laterExpiry(b, a)).toBe(b);
  });

  it('grantPaidEnrollment создаёт зачисление с expiresAt', async () => {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    const paidAt = new Date('2026-10-01T10:00:00Z');
    const res = await grantPaidEnrollment(prisma, { userId: user!.id, courseId, paidAt, accessDays: 90 });
    expect(res?.toISOString()).toBe('2026-12-30T10:00:00.000Z');
  });
});

describe('доступ с истёкшим сроком', () => {
  it('isEnrollmentExpired: прошедший срок — истёк, бессрочный и будущий — нет', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    expect(isEnrollmentExpired({ expiresAt: new Date('2026-10-12T12:00:00Z') }, now)).toBe(true);
    expect(isEnrollmentExpired({ expiresAt: new Date('2026-10-14T12:00:00Z') }, now)).toBe(false);
    expect(isEnrollmentExpired({ expiresAt: null }, now)).toBe(false);
    expect(isEnrollmentExpired(null, now)).toBe(false);
  });

  it('hasCourseLearningAccess закрывает доступ после истечения срока и открывает до него', async () => {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    await prisma.enrollment.create({
      data: { userId: user!.id, courseId, expiresAt: new Date(Date.now() - DAY) },
    });
    expect(await hasCourseLearningAccess(user!.id, courseId, 'user')).toBe(false);

    await prisma.enrollment.update({
      where: { userId_courseId: { userId: user!.id, courseId } },
      data: { expiresAt: new Date(Date.now() + DAY) },
    });
    expect(await hasCourseLearningAccess(user!.id, courseId, 'user')).toBe(true);
  });
});
