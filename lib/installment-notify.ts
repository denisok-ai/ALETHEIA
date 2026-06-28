/**
 * Уведомления по рассрочке: админам (Telegram) и клиентам (email).
 */
import { prisma } from './db';
import { notifyAdminsTelegram } from './telegram-admin-notify';
import { sendTransactionalEmail } from './email-service';

interface InstallmentContext {
  orderNumber: string;
  clientEmail: string;
  clientName: string | null;
  totalParts: number;
  partNumber: number;
  amountRub: number;
  planId: string;
}

function fmt(amount: number): string {
  return amount.toLocaleString('ru-RU');
}

/** Уведомление админу о новой рассрочке. */
export async function notifyInstallmentCreated(ctx: InstallmentContext): Promise<void> {
  await notifyAdminsTelegram('installment_created', [
    `Заказ: ${ctx.orderNumber}`,
    `Клиент: ${ctx.clientName || ctx.clientEmail}`,
    `Сумма: ${fmt(ctx.amountRub)} ₽ × ${ctx.totalParts} частей`,
    `Первый платёж: ${fmt(ctx.amountRub)} ₽`,
  ]);
}

/** Уведомление админу + чек клиенту при успешном платеже. */
export async function notifyInstallmentPaymentPaid(ctx: InstallmentContext): Promise<void> {
  await notifyAdminsTelegram('installment_payment_received', [
    `Заказ: ${ctx.orderNumber}`,
    `Клиент: ${ctx.clientName || ctx.clientEmail}`,
    `Платёж ${ctx.partNumber}/${ctx.totalParts}: ${fmt(ctx.amountRub)} ₽`,
  ]);

  try {
    await sendTransactionalEmail({
      to: ctx.clientEmail,
      subject: `Чек: платёж ${ctx.partNumber}/${ctx.totalParts} по рассрочке — АВАТЕРРА`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#2D1B4E;">АВАТЕРРА — чек об оплате</h2>
          <p>Здравствуйте${ctx.clientName ? `, ${ctx.clientName}` : ''}!</p>
          <p>Получен платёж <strong>${ctx.partNumber} из ${ctx.totalParts}</strong> по рассрочке.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Заказ</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${ctx.orderNumber}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Сумма платежа</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${fmt(ctx.amountRub)} ₽</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Статус</td><td style="padding:8px;border-bottom:1px solid #eee;color:green;">Оплачено</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Спасибо за оплату! Следующий платёж будет списан автоматически.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">АВАТЕРРА · Школа мышечного тестирования</p>
        </div>
      `,
      context: { module: 'installment', entityId: ctx.planId },
    });
  } catch (e) {
    console.error('[installment-notify] email failed:', e);
  }
}

/** Уведомление админу о завершении рассрочки. */
export async function notifyInstallmentCompleted(ctx: InstallmentContext): Promise<void> {
  await notifyAdminsTelegram('installment_completed', [
    `Заказ: ${ctx.orderNumber}`,
    `Клиент: ${ctx.clientName || ctx.clientEmail}`,
    `Все ${ctx.totalParts} платежей получены. Рассрочка завершена.`,
  ]);

  try {
    await sendTransactionalEmail({
      to: ctx.clientEmail,
      subject: `Рассрочка завершена — АВАТЕРРА`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#2D1B4E;">АВАТЕРРА — рассрочка завершена</h2>
          <p>Здравствуйте${ctx.clientName ? `, ${ctx.clientName}` : ''}!</p>
          <p>Все платежи по рассрочке получены. Спасибо!</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Заказ</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${ctx.orderNumber}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Платежей</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${ctx.totalParts}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Статус</td><td style="padding:8px;border-bottom:1px solid #eee;color:green;">Завершена</td></tr>
          </table>
          <p style="color:#999;font-size:12px;margin-top:24px;">АВАТЕРРА · Школа мышечного тестирования</p>
        </div>
      `,
      context: { module: 'installment', entityId: ctx.planId },
    });
  } catch (e) {
    console.error('[installment-notify] email failed:', e);
  }
}

/** Уведомление админу об ошибке списания. */
export async function notifyInstallmentPaymentFailed(
  ctx: InstallmentContext,
  errorMessage: string
): Promise<void> {
  await notifyAdminsTelegram('installment_payment_failed', [
    `Заказ: ${ctx.orderNumber}`,
    `Клиент: ${ctx.clientName || ctx.clientEmail}`,
    `Платёж ${ctx.partNumber}/${ctx.totalParts}: ${fmt(ctx.amountRub)} ₽`,
    `Ошибка: ${errorMessage}`,
    `Требуется ручное вмешательство!`,
  ]);
}

/** Напоминание клиенту о предстоящем списании (за 3 дня и за 1 день). */
export async function notifyInstallmentReminder(
  ctx: InstallmentContext,
  daysUntil: number
): Promise<void> {
  const dayLabel = daysUntil === 1 ? 'завтра' : `через ${daysUntil} дня`;

  await notifyAdminsTelegram('installment_reminder', [
    `Заказ: ${ctx.orderNumber}`,
    `Клиент: ${ctx.clientName || ctx.clientEmail}`,
    `Платёж ${ctx.partNumber}/${ctx.totalParts}: ${fmt(ctx.amountRub)} ₽`,
    `Списание ${dayLabel}`,
  ]);

  try {
    await sendTransactionalEmail({
      to: ctx.clientEmail,
      subject: `Напоминание: платёж по рассрочке ${dayLabel} — АВАТЕРРА`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#2D1B4E;">АВАТЕРРА — напоминание о платеже</h2>
          <p>Здравствуйте${ctx.clientName ? `, ${ctx.clientName}` : ''}!</p>
          <p>${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)} будет списан платёж по рассрочке:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Заказ</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${ctx.orderNumber}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Платёж</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${ctx.partNumber} из ${ctx.totalParts}</td></tr>
            <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Сумма</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${fmt(ctx.amountRub)} ₽</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Убедитесь, что на карте достаточно средств для списания.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">АВАТЕРРА · Школа мышечного тестирования</p>
        </div>
      `,
      context: { module: 'installment', entityId: ctx.planId },
    });
  } catch (e) {
    console.error('[installment-notify] reminder email failed:', e);
  }
}

/** Собрать контекст из InstallmentPayment + Plan + Order. */
export async function buildInstallmentContext(
  paymentId: string
): Promise<InstallmentContext | null> {
  const payment = await prisma.installmentPayment.findUnique({
    where: { id: paymentId },
    include: {
      plan: {
        include: { order: true },
      },
    },
  });
  if (!payment?.plan?.order) return null;
  const { plan, plan: { order } } = payment;
  return {
    orderNumber: order.orderNumber,
    clientEmail: order.clientEmail,
    clientName: order.clientName,
    totalParts: plan.totalParts,
    partNumber: payment.partNumber,
    amountRub: payment.amountRub,
    planId: plan.id,
  };
}
