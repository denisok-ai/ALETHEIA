import { NextRequest, NextResponse } from 'next/server';
import { validatePayKeeperWebhook, getPayKeeperConfigFromSettings } from '@/lib/paykeeper';
import { prisma } from '@/lib/db';
import { getSystemSettings, getPaymentEmailTemplates, renderPaymentEmailTemplate } from '@/lib/settings';
import { sendEmail } from '@/lib/email';
import { triggerNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : value.toString();
    });

    const config = await getPayKeeperConfigFromSettings();
    const secret = config?.secret ?? process.env.PAYKEEPER_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    if (!validatePayKeeperWebhook(params, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const { orderid } = params;
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderid },
    });

    if (!order) {
      console.error('Webhook: order not found', orderid);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await prisma.order.update({
      where: { orderNumber: orderid },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Lead ↔ Order (1.3): при оплате заказа проставить у лидов с тем же email ссылку на заказ
    const emailNorm = order.clientEmail.trim().toLowerCase();
    if (emailNorm) {
      const leads = await prisma.lead.findMany({
        where: { email: { not: null } },
        select: { id: true, email: true },
      });
      const ids = leads.filter((l) => l.email?.trim().toLowerCase() === emailNorm).map((l) => l.id);
      if (ids.length > 0) {
        await prisma.lead.updateMany({ where: { id: { in: ids } }, data: { lastOrderNumber: orderid } }).catch(() => {});
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
    const vars = { orderid, loginUrl, successUrl, portal_title: portalTitle };

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
          where: { orderNumber: orderid },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
