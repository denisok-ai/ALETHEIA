/**
 * Сверка заказа с PayKeeper (по payment id или поиску).
 */

import { prisma } from '@/lib/db';
import { requirePayKeeperConfig } from '@/lib/paykeeper/config';
import { fetchPaymentById, searchPayments, isPaykeeperMoneySettledStatus } from '@/lib/paykeeper/payments';
import { rublesFromPkAmount } from '@/lib/paykeeper/parse';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import {
  maskEmailForLog,
  writePaykeeperIntegrationLog,
} from '@/lib/paykeeper-integration-log';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type SyncOrderResult = {
  ok: boolean;
  message: string;
  payment?: Record<string, unknown>;
  orderStatusUpdated?: boolean;
};

export async function syncOrderWithPaykeeper(orderNumber: string): Promise<SyncOrderResult> {
  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) {
    return { ok: false, message: 'Заказ не найден' };
  }
  const cfg = await requirePayKeeperConfig();

  let rows = order.paykeeperPaymentId
    ? await fetchPaymentById(cfg, order.paykeeperPaymentId)
    : [];

  if (!rows.length) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const found = await searchPayments(cfg, orderNumber, formatDate(start), formatDate(end));
    rows = found.filter(
      (r) => String(r.orderid ?? '').trim() === orderNumber.trim()
    );
    if (!rows.length) {
      await writePaykeeperIntegrationLog({
        direction: 'outbound',
        event: 'sync.order',
        status: 'warning',
        orderNumber,
        message: 'Платёж в PayKeeper не найден (byid/search)',
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { lastSyncedAt: new Date() },
      });
      return { ok: false, message: 'Платёж в PayKeeper не найден за 90 дней' };
    }
  }

  const p = rows[0];
  const pkId = String(p.id ?? '');
  const status = String(p.status ?? '');
  const payAmount = rublesFromPkAmount(typeof p.pay_amount === 'string' ? p.pay_amount : undefined);

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paykeeperPaymentId: pkId || order.paykeeperPaymentId,
      paykeeperStatus: status,
      paykeeperRawStatus: status,
      paidAmountRub: payAmount != null ? Math.round(payAmount) : order.paidAmountRub,
      lastSyncedAt: new Date(),
    },
  });

  await writePaykeeperIntegrationLog({
    direction: 'outbound',
    event: 'sync.order',
    status: 'success',
    orderNumber,
    message: `Сверка: status=${status}, id=${pkId}`,
    payload: { status, id: pkId, pay_amount: p.pay_amount },
  });

  if (order.status === 'pending' && isPaykeeperMoneySettledStatus(status)) {
    const expected = order.amount;
    const got = payAmount != null ? Math.round(payAmount * 100) / 100 : null;
    if (got != null && Math.round(got * 100) !== expected * 100) {
      return {
        ok: true,
        message: `Статус «${status}», но сумма PayKeeper (${got}) ≠ заказу (${expected}) — оплату не подтверждаем автоматически`,
        payment: p as Record<string, unknown>,
      };
    }
    const proc = await processPaidOrder(orderNumber, {
      paykeeperPaymentId: pkId,
      paykeeperStatus: status,
      paidAmountRub: payAmount != null ? Math.round(payAmount) : order.amount,
    });
    return {
      ok: proc.success,
      message: proc.success
        ? 'Заказ синхронизирован и отмечен оплаченным'
        : (proc.error ?? 'processPaidOrder failed'),
      payment: p as Record<string, unknown>,
      orderStatusUpdated: proc.success && !proc.alreadyPaid,
    };
  }

  return {
    ok: true,
    message: `Сверка выполнена: статус PayKeeper «${status}», локальный «${order.status}»`,
    payment: p as Record<string, unknown>,
  };
}
