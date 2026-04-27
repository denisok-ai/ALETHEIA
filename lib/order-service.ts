/**
 * Поиск активного товара (Service) по ключу из заказа: slug или PayKeeper tariff id.
 * Один товар → один курс: перед оплатой и при зачислении проверяйте courseId.
 */
import { prisma } from '@/lib/db';

export type ServiceForOrderTariff = {
  id: string;
  courseId: string | null;
  paykeeperTariffId: string | null;
  slug: string;
  name: string;
  price: number;
};

const serviceSelect = {
  id: true,
  courseId: true,
  paykeeperTariffId: true,
  slug: true,
  name: true,
  price: true,
} as const;

/** Совпадение по slug ИЛИ paykeeperTariffId (как в Order.tariffId после оплаты). */
export async function findActiveServiceForOrderTariff(
  tariffId: string
): Promise<ServiceForOrderTariff | null> {
  const key = tariffId.trim();
  if (!key) return null;
  return prisma.service.findFirst({
    where: {
      isActive: true,
      OR: [{ paykeeperTariffId: key }, { slug: key }],
    },
    select: serviceSelect,
  });
}

/** Только по slug витрины (строгий путь API с полем serviceSlug). */
export async function findActiveServiceBySlug(
  slug: string
): Promise<ServiceForOrderTariff | null> {
  const s = slug.trim();
  if (!s) return null;
  return prisma.service.findFirst({
    where: { slug: s, isActive: true },
    select: serviceSelect,
  });
}

export function orderTariffIdForStorage(service: ServiceForOrderTariff): string {
  const pk = service.paykeeperTariffId?.trim();
  return pk || service.slug;
}

export function assertServiceLinkedToCourse(
  service: ServiceForOrderTariff | null
): { ok: true; courseId: string } | { ok: false; error: string } {
  if (!service) {
    return { ok: false, error: 'Товар не найден в каталоге или отключён.' };
  }
  const cid = service.courseId;
  if (!cid) {
    return {
      ok: false,
      error:
        'У товара не выбран курс. Откройте админку → «Товары для продажи» и привяжите курс.',
    };
  }
  return { ok: true, courseId: cid };
}
