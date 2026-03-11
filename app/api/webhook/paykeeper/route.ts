import { NextRequest, NextResponse } from 'next/server';
import { validatePayKeeperWebhook, getPayKeeperConfigFromSettings } from '@/lib/paykeeper';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
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

    const service = await prisma.service.findFirst({
      where: {
        paykeeperTariffId: order.tariffId,
        isActive: true,
      },
      select: { courseId: true },
    });

    const courseId = service?.courseId;

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

      // Письмо покупателю о successful оплате и доступе к курсу
      const settings = await getSystemSettings();
      const siteUrl = settings.site_url?.replace(/\/$/, '') || process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') || '';
      const courseTitle = course?.title ?? 'Курс';
      const loginUrl = siteUrl ? `${siteUrl}/login` : '/login';
      const successUrl = siteUrl ? `${siteUrl}/success` : '/success';
      const html = `
        <p>Здравствуйте!</p>
        <p>Оплата по заказу ${orderid} получена. Доступ к курсу «${courseTitle}» открыт.</p>
        <p>Войдите в личный кабинет с тем же email, что указали при оплате: <a href="${loginUrl}">${loginUrl}</a></p>
        <p>После входа перейдите в раздел «Мои курсы».</p>
        <p>Если у вас ещё нет аккаунта — зарегистрируйтесь с этим email, и курс будет доступен.</p>
        <p><a href="${successUrl}">Подробнее на странице результата оплаты</a>.</p>
        <p>— AVATERRA</p>
      `;
      await sendEmail(order.clientEmail, 'Оплата получена — доступ к курсу открыт', html);
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
