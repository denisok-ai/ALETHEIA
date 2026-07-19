import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPayKeeperInvoice } from '@/lib/paykeeper';
import { buildPaykeeperServiceNamePayload } from '@/lib/paykeeper/fiscal';
import {
  buildInstallmentContext,
  notifyInstallmentPaymentFailed,
  notifyInstallmentReminder,
} from '@/lib/installment-notify';
import { requireCronAuth } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  const authError = await requireCronAuth(req);
  if (authError) return authError;

  const now = new Date();
  const results: { action: string; paymentId?: string; status: string; detail?: string }[] = [];

  // === 1. Напоминания за 3 дня (с дедупликацией) ===
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in2Days = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const reminder3dPayments = await prisma.installmentPayment.findMany({
    where: {
      status: 'scheduled',
      reminderSent3d: false,
      scheduledAt: { gt: in2Days, lte: in3Days },
    },
    include: { plan: { include: { order: true } } },
    take: 100,
  });

  for (const payment of reminder3dPayments) {
    const ctx = await buildInstallmentContext(payment.id);
    if (ctx) {
      try {
        await notifyInstallmentReminder(ctx, 3);
        await prisma.installmentPayment.update({
          where: { id: payment.id },
          data: { reminderSent3d: true },
        });
        results.push({ action: 'reminder_3d', paymentId: payment.id, status: 'sent' });
      } catch (e) {
        results.push({ action: 'reminder_3d', paymentId: payment.id, status: 'error', detail: String(e) });
      }
    }
  }

  // === 2. Напоминания за 1 день (с дедупликацией) ===
  const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);

  const reminder1dPayments = await prisma.installmentPayment.findMany({
    where: {
      status: 'scheduled',
      reminderSent1d: false,
      scheduledAt: { gt: in12h, lte: in1Day },
    },
    include: { plan: { include: { order: true } } },
    take: 100,
  });

  for (const payment of reminder1dPayments) {
    const ctx = await buildInstallmentContext(payment.id);
    if (ctx) {
      try {
        await notifyInstallmentReminder(ctx, 1);
        await prisma.installmentPayment.update({
          where: { id: payment.id },
          data: { reminderSent1d: true },
        });
        results.push({ action: 'reminder_1d', paymentId: payment.id, status: 'sent' });
      } catch (e) {
        results.push({ action: 'reminder_1d', paymentId: payment.id, status: 'error', detail: String(e) });
      }
    }
  }

  // === 3. Списание просроченных (scheduled + scheduledAt < now) ===
  const duePayments = await prisma.installmentPayment.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: now },
      // Счёт ещё не выставлен. Без этого условия крон (ежечасный) выставлял новый
      // счёт на ОДИН и тот же платёж каждый час, пока платёж не станет overdue —
      // до ~72 живых счетов с одинаковым orderid за трое суток. Клиент мог
      // оплатить два из них: деньги списывались дважды, а вебхук на второй
      // отвечал OK и следа в БД не оставлял.
      paykeeperPaymentId: null,
      // Ретраи не бесконечные: при недоступности PayKeeper клиент иначе получал
      // уведомление «платёж не прошёл» каждый час.
      retryCount: { lt: 5 },
    },
    include: { plan: { include: { order: true } } },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  for (const payment of duePayments) {
    const { plan } = payment;
    if (!plan || !plan.order) {
      results.push({ action: 'charge', paymentId: payment.id, status: 'skipped', detail: 'no order' });
      continue;
    }
    const order = plan.order;
    const installmentTitle = `${order.orderNumber} — рассрочка (${payment.partNumber}/${plan.totalParts})`;
    const serviceNamePayload = await buildPaykeeperServiceNamePayload(
      installmentTitle,
      payment.amountRub
    );
    try {
      const inv = await createPayKeeperInvoice({
        sum: payment.amountRub,
        orderid: `${order.orderNumber}-I${payment.partNumber}`,
        clientid: order.clientEmail,
        service_name: serviceNamePayload,
        client_email: order.clientEmail,
      });
      await prisma.installmentPayment.update({
        where: { id: payment.id },
        data: { paykeeperPaymentId: inv.invoiceId },
      });
      results.push({ action: 'charge', paymentId: payment.id, status: 'invoice_created', detail: inv.invoiceId });
    } catch (pkErr) {
      const msg = pkErr instanceof Error ? pkErr.message : 'PayKeeper error';
      await prisma.installmentPayment.update({
        where: { id: payment.id },
        data: {
          retryCount: { increment: 1 },
          errorMessage: msg.slice(0, 500),
        },
      });
      const ctx = await buildInstallmentContext(payment.id);
      if (ctx) notifyInstallmentPaymentFailed(ctx, msg);
      results.push({ action: 'charge', paymentId: payment.id, status: 'error', detail: msg });
    }
  }

  // === 4. Пометить overdue (просроченные > 3 дней) ===
  const overdueThreshold = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const overduePayments = await prisma.installmentPayment.findMany({
    where: {
      status: 'scheduled',
      scheduledAt: { lte: overdueThreshold },
    },
    take: 100,
  });
  for (const payment of overduePayments) {
    await prisma.installmentPayment.update({
      where: { id: payment.id },
      data: { status: 'overdue' },
    });
    results.push({ action: 'mark_overdue', paymentId: payment.id, status: 'done' });
  }

  return NextResponse.json({
    reminders_3d: results.filter((r) => r.action === 'reminder_3d').length,
    reminders_1d: results.filter((r) => r.action === 'reminder_1d').length,
    charges: results.filter((r) => r.action === 'charge').length,
    overdue: results.filter((r) => r.action === 'mark_overdue').length,
    results,
  });
}
