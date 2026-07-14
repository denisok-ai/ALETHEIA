/**
 * Обработка успешной оплаты (webhook PayKeeper): обновление заказа, лиды, запись на курс, письма.
 * Используется в POST /api/webhook/paykeeper, ручном подтверждении заказа, симуляции и бесплатном доступе.
 * site_url и прочие настройки — из БД (Портал → Настройки).
 */
import { hash } from 'bcryptjs';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSystemSettings, getPaymentEmailTemplates, renderPaymentEmailTemplate } from '@/lib/settings';
import { wrapEmailHtml } from '@/lib/email-templates';
import { sendTransactionalEmail } from '@/lib/email-service';
import { triggerNotification } from '@/lib/notifications';
import { createPasswordToken } from '@/lib/password-token';
import { findActiveServiceForOrderTariff, findPersonalProductForOrderTariff } from '@/lib/order-service';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

async function sendPaymentEmail(params: {
  order: { id: number; clientEmail: string };
  subject: string;
  html: string;
  userId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const html = wrapEmailHtml(params.html, { title: params.subject });
  return sendTransactionalEmail({
    to: params.order.clientEmail.trim(),
    subject: params.subject,
    html,
    context: {
      module: 'payments',
      entityId: String(params.order.id),
      userId: params.userId,
    },
  });
}

export type ProcessPaidOrderResult = {
  success: boolean;
  error?: string;
  /** Заказ уже был оплачен до вызова — повторная обработка не выполнялась. */
  alreadyPaid?: boolean;
  courseId?: string | null;
  enrollmentCreated?: boolean;
  userId?: string | null;
  userWasAutoCreated?: boolean;
  emailKind?: 'set_password' | 'course_access' | 'generic' | 'fallback_register' | 'none';
  warnings?: string[];
};

export type ProcessPaidOrderPaykeeperMeta = {
  paykeeperPaymentId?: string;
  paykeeperStatus?: string;
  paidAmountRub?: number;
};

/**
 * Лиды с тем же email (без «потерянных»): lastOrderNumber; при наличии userId —
 * конвертация new/contacted/qualified → converted + convertedToUserId.
 * Поиск по lower(trim(email)) через SQL (SQLite), без полного скана таблицы в JS.
 */
async function syncLeadsAfterOrderPaid(orderNumber: string, clientEmailRaw: string, userId: string | null) {
  const emailNorm = clientEmailRaw.trim().toLowerCase();
  if (!emailNorm) return;

  const rows = await prisma.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM "Lead" WHERE email IS NOT NULL AND lower(trim(email)) = ${emailNorm} AND status != 'lost'`
  );
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;

  await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: { lastOrderNumber: orderNumber },
  });

  if (userId) {
    await prisma.lead.updateMany({
      where: {
        id: { in: ids },
        status: { in: ['new', 'contacted', 'qualified'] },
      },
      data: { status: 'converted', convertedToUserId: userId },
    });
  }
}

export async function processPaidOrder(
  orderNumber: string,
  paykeeperMeta?: ProcessPaidOrderPaykeeperMeta
): Promise<ProcessPaidOrderResult> {
  const warnings: string[] = [];
  const order = await prisma.order.findUnique({
    where: { orderNumber },
  });
  if (!order) {
    return { success: false, error: 'Order not found' };
  }
  if (order.status === 'paid') {
    console.info('[PayKeeper webhook] idempotent_ok already_paid', { orderNumber });
    if (paykeeperMeta?.paykeeperPaymentId && order.paykeeperPaymentId !== paykeeperMeta.paykeeperPaymentId) {
      await prisma.order
        .update({
          where: { orderNumber },
          data: {
            paykeeperPaymentId: paykeeperMeta.paykeeperPaymentId,
            paykeeperStatus: paykeeperMeta.paykeeperStatus ?? order.paykeeperStatus,
            paidAmountRub: paykeeperMeta.paidAmountRub ?? order.paidAmountRub,
          },
        })
        .catch(() => {});
    }
    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'process_paid_order.idempotent',
      status: 'success',
      orderNumber,
      message: 'Заказ уже был оплачен — повторная обработка пропущена',
    });
    return { success: true, alreadyPaid: true };
  }

  await prisma.order.update({
    where: { orderNumber },
    data: {
      status: 'paid',
      paidAt: new Date(),
      ...(paykeeperMeta?.paykeeperPaymentId != null && {
        paykeeperPaymentId: paykeeperMeta.paykeeperPaymentId,
      }),
      ...(paykeeperMeta?.paykeeperStatus != null && {
        paykeeperStatus: paykeeperMeta.paykeeperStatus,
      }),
      ...(paykeeperMeta?.paidAmountRub != null && { paidAmountRub: paykeeperMeta.paidAmountRub }),
    },
  });

  const service = order.tariffId
    ? await findActiveServiceForOrderTariff(order.tariffId)
    : null;
  const personalProduct = order.tariffId
    ? await findPersonalProductForOrderTariff(order.tariffId)
    : null;
  const paymentLink =
    personalProduct != null
      ? await prisma.paymentLink.findFirst({ where: { orderId: order.id } })
      : null;
  const courseId = service?.courseId ?? null;

  if (order.tariffId && !service && !personalProduct) {
    const msg = `Заказ ${orderNumber}: tariffId="${order.tariffId}" — активный товар не найден (slug / paykeeperTariffId / personal).`;
    console.warn(`[PayKeeper] ${msg}`);
    warnings.push(msg);
  } else if (service && !courseId) {
    const msg = `Заказ ${orderNumber}: товар «${service.name}» без привязки к курсу — зачисление невозможно.`;
    console.warn(`[PayKeeper] ${msg}`);
    warnings.push(msg);
  }

  const [settings, paymentTpl] = await Promise.all([
    getSystemSettings(),
    getPaymentEmailTemplates(),
  ]);
  const siteUrl = settings.site_url?.replace(/\/$/, '') || '';
  const portalTitle = settings.portal_title || 'AVATERRA';
  const loginUrl = siteUrl ? `${siteUrl}/login` : '/login';
  const registerUrl = siteUrl ? `${siteUrl}/register` : '/register';
  const successUrl = siteUrl ? `${siteUrl}/success` : '/success';
  const portalUrl = siteUrl || '';
  const ofertaUrl = siteUrl ? `${siteUrl}/oferta` : '/oferta';
  const supportEmail = settings.resend_notify_email?.trim() || '';
  const orderAmount = `${order.amount.toLocaleString('ru-RU')} ₽`;
  const emailLocal = order.clientEmail.trim().split('@')[0] || 'клиент';

  let enrollmentCreated = false;
  let resultUserId: string | null = null;
  let userWasAutoCreated = false;
  let emailKind: ProcessPaidOrderResult['emailKind'] = 'none';
  let courseTitleLabel = '';

  if (courseId) {
    const [user, course] = await Promise.all([
      prisma.user.findFirst({
        where: { email: order.clientEmail.trim() },
        select: { id: true, profile: { select: { displayName: true } } },
      }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true },
      }),
    ]);

    let userId = user?.id;

    if (!userId) {
      try {
        const tempPassword = nanoid(24);
        const passwordHash = await hash(tempPassword, 10);
        const emailTrim = order.clientEmail.trim();
        /** Берём ФИО из формы checkout (Order.clientName), если оно похоже на имя. Иначе оставляем null — письма используют общее обращение. */
        const rawClientName = order.clientName?.trim() ?? '';
        const displayName: string | null =
          rawClientName && !/@/.test(rawClientName) && !/^[a-z0-9_.+-]+$/i.test(rawClientName)
            ? rawClientName
            : null;
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
      enrollmentCreated = true;
      resultUserId = userId;
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
    courseTitleLabel = courseTitle;
    /** ФИО клиента: предпочтение Order.clientName из checkout-формы, затем displayName профиля, иначе общее обращение, чтобы в письме не появлялся email-логин. */
    const profileName = user?.profile?.displayName?.trim() ?? '';
    const orderName = order.clientName?.trim() ?? '';
    const candidateName = orderName || profileName;
    const userName =
      candidateName && !/@/.test(candidateName) && !/^[a-z0-9_.+-]+$/i.test(candidateName)
        ? candidateName
        : 'уважаемый клиент';

    if (userId && userWasAutoCreated) {
      emailKind = 'set_password';
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
<p>После установки пароля войдите на сайт и откройте раздел «Мои курсы».</p>
<p>— ${portalTitle}</p>`;
      const mailRes = await sendPaymentEmail({ order, subject, html: body, userId });
      if (!mailRes.ok) {
        console.error('[PayKeeper] Send set-password email:', mailRes.error);
        warnings.push('Не удалось отправить письмо со ссылкой на установку пароля.');
      }
    } else if (userId) {
      emailKind = 'course_access';
      const vars = {
        orderid: orderNumber,
        loginUrl,
        successUrl,
        portal_title: portalTitle,
        courseTitle,
        userName,
        orderAmount,
        supportEmail,
        portalUrl,
        ofertaUrl,
        company_address: settings.company_legal_address?.trim() || '',
      };
      const subject = renderPaymentEmailTemplate(paymentTpl.courseSubject, vars);
      const body = renderPaymentEmailTemplate(paymentTpl.courseBody, vars);
      const mailResAccess = await sendPaymentEmail({ order, subject, html: body, userId });
      if (!mailResAccess.ok) {
        console.error('[PayKeeper] Send course access email:', mailResAccess.error);
        warnings.push('Не удалось отправить письмо о доступе к курсу.');
      }
    } else {
      emailKind = 'fallback_register';
      const subject = `${portalTitle}: оплата получена — зарегистрируйтесь для доступа к курсу`;
      const body = `<p>Здравствуйте!</p>
<p>Оплата по заказу ${orderNumber} получена. Курс «${courseTitle}» оплачен.</p>
<p>Зарегистрируйтесь на сайте с тем же email, чтобы получить доступ к курсу: <a href="${registerUrl}">Регистрация</a>. Если аккаунт уже есть — <a href="${loginUrl}">войдите</a>.</p>
<p>— ${portalTitle}</p>`;
      const mailRes = await sendPaymentEmail({ order, subject, html: body, userId: null });
      if (!mailRes.ok) {
        console.error('[PayKeeper] Send fallback course email:', mailRes.error);
        warnings.push('Не удалось отправить письмо с инструкцией по регистрации.');
      }
    }
  } else {
    emailKind = 'generic';
    const vars = {
      orderid: orderNumber,
      loginUrl,
      successUrl,
      portal_title: portalTitle,
      courseTitle: personalProduct?.name ?? '',
      userName: 'уважаемый клиент',
      orderAmount,
      supportEmail,
      portalUrl,
      ofertaUrl,
      company_address: settings.company_legal_address?.trim() || '',
    };
    // Платёжная ссылка (personal-*): письмо и Telegram уже отправлены в webhook до processPaidOrder.
    if (!paymentLink) {
      const subject = renderPaymentEmailTemplate(paymentTpl.genericSubject, vars);
      const body = renderPaymentEmailTemplate(paymentTpl.genericBody, vars);
      const mailRes = await sendPaymentEmail({
        order,
        subject,
        html: body,
        userId: resultUserId ?? order.userId ?? null,
      });
      if (!mailRes.ok) {
        console.error('[PayKeeper] Send generic payment email:', mailRes.error);
        warnings.push('Не удалось отправить письмо об оплате.');
      }
    } else {
      emailKind = 'none';
    }
  }

  let crmUserId = resultUserId;
  if (!crmUserId && order.clientEmail.trim()) {
    const u = await prisma.user.findFirst({
      where: { email: order.clientEmail.trim() },
      select: { id: true },
    });
    crmUserId = u?.id ?? null;
  }
  await syncLeadsAfterOrderPaid(orderNumber, order.clientEmail, crmUserId);

  const result: ProcessPaidOrderResult = {
    success: true,
    courseId,
    enrollmentCreated,
    userId: resultUserId,
    userWasAutoCreated: enrollmentCreated ? userWasAutoCreated : false,
    emailKind,
  };
  if (warnings.length > 0) {
    result.warnings = warnings;
    console.info('[PayKeeper] process_paid_order_done', { orderNumber, warnings });
    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'process_paid_order.warnings',
      status: 'warning',
      orderNumber,
      message: 'processPaidOrder завершён с предупреждениями',
      payload: { warnings, emailKind: result.emailKind, enrollmentCreated: result.enrollmentCreated },
    });
  }

  if (!paymentLink) {
    notifyAdminsTelegramAsync('payment_received', [
      `Заказ: ${orderNumber}`,
      `Сумма: ${orderAmount}`,
      `Email: ${order.clientEmail.trim()}`,
      ...(personalProduct ? [`Персональный товар: ${personalProduct.name}`] : []),
      ...(courseTitleLabel ? [`Курс: ${courseTitleLabel}`] : []),
      enrollmentCreated ? 'Зачисление: да' : 'Зачисление: нет',
    ]);
  }

  return result;
}
