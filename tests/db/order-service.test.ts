/**
 * Поиск товара по Order.tariffId для действий над оплаченным заказом (возврат → закрыть доступ).
 * Регрессия 13.10.2026: возврат искал товар только по paykeeperTariffId среди активных,
 * поэтому у заказов по slug (ЮKassa, витрина) доступ к курсу после возврата не закрывался.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { findActiveServiceForOrderTariff, findServiceForOrderTariff } from '@/lib/order-service';

async function cleanup() {
  await prisma.service.deleteMany({ where: { slug: { startsWith: 'test-os-' } } });
  await prisma.course.deleteMany({ where: { title: { startsWith: 'test-os-' } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('findServiceForOrderTariff', () => {
  it('находит товар по slug, даже снятый с продажи', async () => {
    const course = await prisma.course.create({ data: { title: 'test-os-course' } });
    await prisma.service.create({
      data: { slug: 'test-os-slug', name: 'Тест', price: 10, courseId: course.id, isActive: false },
    });

    expect(await findActiveServiceForOrderTariff('test-os-slug')).toBeNull();
    const found = await findServiceForOrderTariff('test-os-slug');
    expect(found?.courseId).toBe(course.id);
  });

  it('находит товар по paykeeperTariffId', async () => {
    const course = await prisma.course.create({ data: { title: 'test-os-course-2' } });
    await prisma.service.create({
      data: { slug: 'test-os-pk', name: 'Тест', price: 10, courseId: course.id, paykeeperTariffId: 'test-os-tariff-42' },
    });

    expect((await findServiceForOrderTariff('test-os-tariff-42'))?.courseId).toBe(course.id);
  });

  it('пустой tariffId — null', async () => {
    expect(await findServiceForOrderTariff(null)).toBeNull();
    expect(await findServiceForOrderTariff('  ')).toBeNull();
  });
});
