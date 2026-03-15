/**
 * Привязка оплаченных заказов по email к пользователю: создание Enrollment,
 * уведомление, проставление Order.userId. Используется при регистрации и при первом входе в ЛК.
 * Оптимизировано: один findMany по сервисам вместо N findFirst на заказ.
 */
import { prisma } from '@/lib/db';
import { triggerNotification } from '@/lib/notifications';

export async function claimPaidOrdersForUser(userId: string, emailNorm: string): Promise<number> {
  const [paidOrders, services] = await Promise.all([
    prisma.order.findMany({
      where: { status: 'paid', userId: null },
      select: { id: true, tariffId: true, clientEmail: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      select: { paykeeperTariffId: true, courseId: true },
    }),
  ]);

  const tariffToCourse = new Map<string, string | null>();
  for (const s of services) {
    if (s.paykeeperTariffId) tariffToCourse.set(s.paykeeperTariffId, s.courseId);
  }

  const forUser = paidOrders.filter(
    (o) => o.clientEmail.trim().toLowerCase() === emailNorm
  );

  const allIds = forUser.map((o) => tariffToCourse.get(o.tariffId)).filter((id): id is string => Boolean(id));
  const courseIds = allIds.filter((id, i) => allIds.indexOf(id) === i);
  const courseTitles = courseIds.length > 0
    ? await prisma.course.findMany({
        where: { id: { in: courseIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleByCourseId = new Map(courseTitles.map((c) => [c.id, c.title]));

  let claimed = 0;
  for (const order of forUser) {
    const courseId = tariffToCourse.get(order.tariffId);
    if (!courseId) continue;
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });
    await triggerNotification({
      eventType: 'enrollment',
      userId,
      metadata: { objectname: titleByCourseId.get(courseId) ?? '' },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { userId },
    });
    claimed += 1;
  }
  return claimed;
}
