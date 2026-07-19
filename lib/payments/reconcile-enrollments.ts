/**
 * Страховочная сетка: заказы, где деньги получены, а доступа к курсу нет.
 *
 * Зачем: в processPaidOrder статус `paid` фиксируется раньше, чем создаётся
 * зачисление, и между ними идёт длинная цепочка операций. Сбой посередине
 * (перезапуск при деплое, OOM, ошибка создания пользователя) оставлял заказ
 * оплаченным без доступа, а повторная доставка вебхука в эту ситуацию не
 * заходила — состояние консервировалось навсегда.
 *
 * Эта сверка работает снаружи запроса и ловит расхождение независимо от
 * причины, включая уже накопленные случаи. Её ценность в том, что она не
 * зависит от того, повторит ли PayKeeper доставку.
 *
 * Безопасность: возвращённые и отменённые заказы исключаются явно — по ним
 * доступ закрывают намеренно, и автоматическая выдача была бы ошибкой.
 */
import { prisma } from '@/lib/db';
import { findActiveServiceForOrderTariff } from '@/lib/order-service';

export type MissingEnrollment = {
  orderNumber: string;
  clientEmail: string;
  courseId: string;
  userId: string | null;
  /** Нет пользователя с таким email — доступ выдать не на кого. */
  needsUser: boolean;
  paidAt: Date | null;
  /** Сумма заказа: по ней админ отличает тестовые оплаты от настоящих. */
  amount: number;
};

export type ReconcileResult = {
  scanned: number;
  missing: MissingEnrollment[];
  repaired: string[];
  /** Расхождения, которые автоматика чинить не стала (нет пользователя). */
  needsAttention: MissingEnrollment[];
};

/**
 * Заказы, по которым доступ положен, но зачисления нет.
 *
 * Товар без курса (персональные товары по платёжным ссылкам) расхождением не
 * считается: там зачисление не предусмотрено замыслом.
 */
export async function findMissingEnrollments(limit = 500): Promise<{
  scanned: number;
  missing: MissingEnrollment[];
}> {
  const orders = await prisma.order.findMany({
    // Фильтр по tariffId делается ниже, в коде: эта версия Prisma (5.22)
    // отвергает null в таких условиях в рантайме, а typecheck их пропускает —
    // и `{ not: null }`, и `NOT: { tariffId: null }`. Заказов немного, отсев
    // в коде ничего не стоит.
    where: { status: 'paid' },
    orderBy: { id: 'desc' },
    take: limit,
    select: {
      orderNumber: true,
      tariffId: true,
      clientEmail: true,
      paidAt: true,
      refundedAmountRub: true,
      amount: true,
    },
  });

  const missing: MissingEnrollment[] = [];

  for (const order of orders) {
    // Частично или полностью возвращённые заказы не трогаем: по ним доступ
    // закрывают намеренно (см. закрытие Enrollment при возврате в админке).
    if ((order.refundedAmountRub ?? 0) > 0) continue;

    const email = order.clientEmail?.trim();
    if (!email || !order.tariffId) continue;

    const service = await findActiveServiceForOrderTariff(order.tariffId);
    const courseId = service?.courseId;
    // Нет товара или товар не привязан к курсу — доступ по нему не выдаётся.
    if (!courseId) continue;

    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });

    if (user) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId } },
        select: { id: true },
      });
      if (enrollment) continue;
    }

    missing.push({
      orderNumber: order.orderNumber,
      clientEmail: email,
      courseId,
      userId: user?.id ?? null,
      needsUser: !user,
      paidAt: order.paidAt,
      amount: order.amount,
    });
  }

  return { scanned: orders.length, missing };
}

/**
 * Восстановить доступ по одному заказу.
 *
 * Вызывается из ветки «заказ уже оплачен» в обработчике вебхука: раньше она
 * просто выходила, из-за чего повторная доставка от PayKeeper — единственный
 * автоматический шанс что-то исправить — пропадала впустую. Теперь ретрай
 * лечит частичное состояние вместо того, чтобы его консервировать.
 *
 * Возвращает true, только если доступ действительно был выдан сейчас.
 */
export async function repairEnrollmentForOrder(orderNumber: string): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { tariffId: true, clientEmail: true, refundedAmountRub: true, status: true },
  });
  if (!order || order.status !== 'paid') return false;
  if ((order.refundedAmountRub ?? 0) > 0) return false;

  const email = order.clientEmail?.trim();
  if (!email || !order.tariffId) return false;

  const service = await findActiveServiceForOrderTariff(order.tariffId);
  const courseId = service?.courseId;
  if (!courseId) return false;

  const user = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!user) return false;

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.upsert({
      where: { userId_courseId: { userId: user.id, courseId } },
      create: { userId: user.id, courseId },
      update: {},
    });
    await tx.order.update({ where: { orderNumber }, data: { userId: user.id } });
  });
  return true;
}

/**
 * Найти и (при `repair`) восстановить доступ.
 *
 * Автоматически чинится только случай «пользователь есть, зачисления нет» —
 * это чистая потеря записи. Случай «пользователя нет» в автоматику не отдаём:
 * создание аккаунта тянет за собой пароль, письмо и профиль, и делать это
 * вслепую по расписанию рискованно — такие заказы выносятся админам.
 */
export async function reconcileEnrollments(
  options: { repair: boolean; limit?: number } = { repair: false }
): Promise<ReconcileResult> {
  const { scanned, missing } = await findMissingEnrollments(options.limit ?? 500);
  const repaired: string[] = [];
  const needsAttention = missing.filter((m) => m.needsUser);

  if (options.repair) {
    for (const item of missing) {
      if (!item.userId) continue;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId: item.userId!, courseId: item.courseId } },
            create: { userId: item.userId!, courseId: item.courseId },
            update: {},
          });
          await tx.order.update({
            where: { orderNumber: item.orderNumber },
            data: { userId: item.userId! },
          });
        });
        repaired.push(item.orderNumber);
      } catch (e) {
        console.error(`[reconcile] заказ ${item.orderNumber}: восстановить не удалось:`, e);
      }
    }
  }

  return { scanned, missing, repaired, needsAttention };
}
