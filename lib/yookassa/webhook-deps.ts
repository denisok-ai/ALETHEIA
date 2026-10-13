/**
 * Боевые зависимости обработчика вебхука ЮKassa: БД, API, общая цепочка оплаты.
 */
import { prisma } from '@/lib/db';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import { repairEnrollmentForOrder } from '@/lib/payments/reconcile-enrollments';
import { markPaymentLinkPaidForOrder } from '@/lib/payments/payment-link-paid';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';
import { fetchYooKassaPayment } from '@/lib/yookassa/client';
import { requireYooKassaConfig } from '@/lib/yookassa/config';
import type { YooKassaWebhookDeps } from '@/lib/yookassa/webhook';

export function buildYooKassaWebhookDeps(): YooKassaWebhookDeps {
  return {
    fetchPayment: async (paymentId) => {
      const cfg = await requireYooKassaConfig();
      return fetchYooKassaPayment(cfg, paymentId);
    },

    findOrder: (orderNumber) =>
      prisma.order.findUnique({
        where: { orderNumber },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          amount: true,
          providerPaymentId: true,
          refundedAmountRub: true,
        },
      }),

    attachPayment: async (orderNumber, paymentId) => {
      // userId здесь не трогаем: он ставится только вместе с зачислением (processPaidOrder).
      await prisma.order.update({
        where: { orderNumber },
        data: { paymentProvider: 'yookassa', providerPaymentId: paymentId },
      });
    },

    markPaymentLinkPaid: (orderNumber) => markPaymentLinkPaidForOrder(orderNumber),

    processPaidOrder: (orderNumber) => processPaidOrder(orderNumber),

    repairEnrollment: (orderNumber) => repairEnrollmentForOrder(orderNumber),

    cancelPendingOrder: async (orderNumber) => {
      const res = await prisma.order.updateMany({
        where: { orderNumber, status: 'pending' },
        data: { status: 'cancelled' },
      });
      return res.count > 0;
    },

    log: async (entry) => {
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: entry.event,
        status: entry.status,
        orderNumber: entry.orderNumber ?? null,
        message: entry.message,
        payload: entry.payload,
      }).catch(() => {});
      console.info(`[yookassa] ${entry.event}`, entry.orderNumber ?? '', entry.message);
    },

    alert: (_kind, lines) => {
      notifyAdminsTelegramAsync('payment_needs_attention', [`ЮKassa: ${lines[0] ?? ''}`, ...lines.slice(1)]);
    },
  };
}
