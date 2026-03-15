/**
 * Обработка успешной оплаты (webhook PayKeeper): обновление заказа, лиды, запись на курс, письма.
 * Используется в POST /api/webhook/paykeeper и в симуляции оплаты из админки.
 * При оплате курса гостем: автосоздание User + Profile + Enrollment и отправка ссылки «Установить пароль».
 */
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/db';
import { getSystemSettings, getPaymentEmailTemplates, renderPaymentEmailTemplate } from '@/lib/settings';
import { sendEmail } from '@/lib/email';
import { triggerNotification } from '@/lib/notifications';
import { createPasswordToken } from '@/lib/password-token';

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

  if (order.tariffId && !courseId) {
    console.warn(
      `[PayKeeper] Заказ ${orderNumber}: tariffId="${order.tariffId}" — услуга не найдена или курс не привязан. Зачисление не создано.`
    );
  }

  const [settings, paymentTpl] = await Promise.all([
    getSystemSettings(),
    getPaymentEmailTemplates(),
  ]);
  const siteUrl = settings.site_url?.replace(/\/$/, '') || process.env.NEXT_PUBLIC_URL?.replace(/\/$/, '') || '';
  const portalTitle = settings.portal_title || 'AVATERRA';
  const loginUrl = siteUrl ? `${siteUrl}/login` : '/login';
  const registerUrl = siteUrl ? `${siteUrl}/register` : '/register';
  const successUrl = siteUrl ? `${siteUrl}/success` : '/success';
  const vars = { orderid: orderNumber, loginUrl, successUrl, portal_title: portalTitle };

  if (courseId) {
    const [user, course] = await Promise.all([
      prisma.user.findFirst({
        where: { email: order.clientEmail.trim() },
        select: { id: true },
      }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      }),
    ]);

    let userId = user?.id;
    let userWasAutoCreated = false;

    if (!userId) {
      try {
        const tempPassword = nanoid(24);
        const passwordHash = await hash(tempPassword, 10);
        const emailTrim = order.clientEmail.trim();
        const displayName = emailTrim.split('@')[0] || null;
        const newUser = await prisma.user.create({
          data: {
            email: emailTrim,
            passwordHash,
            displayName,
          },
        });
        await prisma.profile.create({
          data: {
            id: `p-${newUser.id}`,
            userId: newUser.id,
            role: 'user',
            status: 'active',
            email: newUser.email,
            displayName,
            emailVerifiedAt: new Date(),
          },
        });
        userId = newUser.id;
        userWasAutoCreated = true;
      } catch (err: unknown) {
        const isUniqueViolation =
          err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002';
        if (isUniqueViolation) {
          const existing = await prisma.user.findFirst({
            where: { email: order.clientEmail.trim() },
            select: { id: true },
          });
          if (existing) userId = existing.id;
        }
        if (!userId) throw err;
      }
    }

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

    if (userId && userWasAutoCreated) {
      const token = await createPasswordToken(userId);
      const setPasswordUrl = siteUrl
        ? `${siteUrl}/set-password?token=${encodeURIComponent(token)}`
        : `/set-password?token=${encodeURIComponent(token)}`;
      const subject = `${portalTitle}: установите пароль для доступа к курсу`;
      const body = `<p>Здравствуйте!</p>
<p>Оплата по заказу ${orderNumber} получена. Для вас создан аккаунт в личном кабинете.</p>
<p>Установите пароль по ссылке (действует 48 часов), чтобы войти и получить доступ к курсу «${courseTitle}»:</p>
<p><a href="${setPasswordUrl}">Установить пароль</a></p>
<p>Если ссылка не открывается, скопируйте в браузер: ${setPasswordUrl}</p>
<p>— ${portalTitle}</p>`;
      try {
        await sendEmail(order.clientEmail, subject, body);
      } catch (mailErr) {
        console.error('[PayKeeper] Send set-password email:', mailErr);
      }
    } else if (userId) {
      const subject = renderPaymentEmailTemplate(paymentTpl.courseSubject, { ...vars, courseTitle });
      const body = renderPaymentEmailTemplate(paymentTpl.courseBody, { ...vars, courseTitle });
      await sendEmail(order.clientEmail, subject, body);
    } else {
      const subject = `${portalTitle}: оплата получена — зарегистрируйтесь для доступа к курсу`;
      const body = `<p>Здравствуйте!</p>
<p>Оплата по заказу ${orderNumber} получена. Курс «${courseTitle}» оплачен.</p>
<p>Зарегистрируйтесь на сайте с тем же email, чтобы получить доступ к курсу: <a href="${registerUrl}">Регистрация</a>. Если аккаунт уже есть — <a href="${loginUrl}">войдите</a>.</p>
<p>— ${portalTitle}</p>`;
      try {
        await sendEmail(order.clientEmail, subject, body);
      } catch (mailErr) {
        console.error('[PayKeeper] Send fallback course email:', mailErr);
      }
    }
  } else {
    const subject = renderPaymentEmailTemplate(paymentTpl.genericSubject, vars);
    const body = renderPaymentEmailTemplate(paymentTpl.genericBody, vars);
    await sendEmail(order.clientEmail, subject, body);
  }

  return { success: true };
}
