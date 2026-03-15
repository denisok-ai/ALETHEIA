/**
 * Обработка успешной оплаты (webhook PayKeeper): обновление заказа, лиды, запись на курс, письма.
 * Используется в POST /api/webhook/paykeeper и в симуляции оплаты из админки.
 */
import { prisma } from '@/lib/db';
import { getSystemSettings, getPaymentEmailTemplates, renderPaymentEmailTemplate } from '@/lib/settings';
import { sendEmail } from '@/lib/email';
import { triggerNotification } from '@/lib/notifications';

export async function processPaidOrder(orderNumber: string): Promise<{ success: boolean; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
  });
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  await prisma.order.update({
    where: { orderNumber },
    data: { status: 'paid', paidAt: new Date() },
  });

  const emailNorm = order.clientEmail.trim().toLowerCase();
  if (emailNorm) {
    const leads = await prisma.lead.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true },
    });
    const ids = leads.filter((l) => l.email?.trim().toLowerCase() === emailNorm).map((l) => l.id);
    if (ids.length > 0) {
      await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { lastOrderNumber: orderNumber } }).catch(() => {});
    }
  }

  const service = await prisma.service.findFirst({
    where: {
      paykeeperTariffId: order.tariffId,
      isActive: true,
    },
    select: { courseId: true },
  });

  const courseId = service?.courseId;

  const [settings, paymentTpl] = await Promise.all([
    getSystemSettings(),
    getPaymentEmailTemplates(),
  ]);
  const siteUrl = settings.site_url?.replace(/\/$/, '') || process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') || '';
  const portalTitle = settings.portal_title || 'AVATERRA';
  const loginUrl = siteUrl ? `${siteUrl}/login` : '/login';
  const successUrl = siteUrl ? `${siteUrl}/success` : '/success';
  const vars = { orderid: orderNumber, loginUrl, successUrl, portal_title: portalTitle };

  if (courseId) {
    const [user, course] = await Promise.all([
      prisma.user.findFirst({
        where: { email: order.clientEmail },
        select: { id: true },
      }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      }),
    ]);

    const userId = user?.id;
    if (userId) {
      await prisma.enrollment.upsert({
        where: {
          userId_courseId: { userId, courseId },
        },
        create: { userId, courseId },
        update: {},
      });
      await triggerNotification({
        eventType: 'enrollment',
        userId,
        metadata: { objectname: course?.title ?? '' },
      });
      await prisma.order.update({
        where: { orderNumber },
        data: { userId },
      });
    }

    const courseTitle = course?.title ?? 'Курс';
    const subject = renderPaymentEmailTemplate(paymentTpl.courseSubject, { ...vars, courseTitle });
    const body = renderPaymentEmailTemplate(paymentTpl.courseBody, { ...vars, courseTitle });
    await sendEmail(order.clientEmail, subject, body);
  } else {
    const subject = renderPaymentEmailTemplate(paymentTpl.genericSubject, vars);
    const body = renderPaymentEmailTemplate(paymentTpl.genericBody, vars);
    await sendEmail(order.clientEmail, subject, body);
  }

  return { success: true };
}
