import { describe, expect, it, vi } from 'vitest';
import {
  handleYooKassaNotification,
  type WebhookOrder,
  type YooKassaWebhookDeps,
} from '@/lib/yookassa/webhook';
import type { YooKassaPayment } from '@/lib/yookassa/types';

/** Фейковое хранилище заказов: processPaidOrder в моке переводит заказ в paid. */
function makeHarness(opts: {
  order?: Partial<WebhookOrder> | null;
  payment: YooKassaPayment;
  fetchError?: Error;
  processOk?: boolean;
}) {
  const store: { order: WebhookOrder | null } = {
    order:
      opts.order === null
        ? null
        : {
            id: 7,
            orderNumber: 'ALT-TEST1',
            status: 'pending',
            amount: 5000,
            providerPaymentId: null,
            refundedAmountRub: 0,
            ...opts.order,
          },
  };

  const deps = {
    fetchPayment: vi.fn(async () => {
      if (opts.fetchError) throw opts.fetchError;
      return opts.payment;
    }),
    findOrder: vi.fn(async () => (store.order ? { ...store.order } : null)),
    attachPayment: vi.fn(async (_orderNumber: string, paymentId: string) => {
      if (store.order) store.order.providerPaymentId = paymentId;
    }),
    markPaymentLinkPaid: vi.fn(async () => {}),
    processPaidOrder: vi.fn(async () => {
      if (opts.processOk === false) return { success: false, error: 'boom' };
      if (store.order) store.order.status = 'paid';
      return { success: true, enrollmentCreated: true };
    }),
    repairEnrollment: vi.fn(async () => false),
    cancelPendingOrder: vi.fn(async () => {
      if (store.order && store.order.status === 'pending') {
        store.order.status = 'cancelled';
        return true;
      }
      return false;
    }),
    log: vi.fn(async () => {}),
    alert: vi.fn(() => {}),
  };

  return { deps: deps as unknown as YooKassaWebhookDeps & typeof deps, store };
}

const succeededPayment: YooKassaPayment = {
  id: 'pay-1',
  status: 'succeeded',
  paid: true,
  amount: { value: '5000.00', currency: 'RUB' },
  metadata: { orderNumber: 'ALT-TEST1' },
};

const succeededNotification = { type: 'notification', event: 'payment.succeeded', object: { id: 'pay-1' } };

describe('handleYooKassaNotification', () => {
  it('payment.succeeded: заказ оплачен один раз, processPaidOrder вызван ровно один раз', async () => {
    const h = makeHarness({ payment: succeededPayment });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);

    expect(res.status).toBe(200);
    expect(h.deps.fetchPayment).toHaveBeenCalledWith('pay-1');
    expect(h.deps.attachPayment).toHaveBeenCalledWith('ALT-TEST1', 'pay-1');
    expect(h.deps.processPaidOrder).toHaveBeenCalledTimes(1);
    expect(h.deps.processPaidOrder).toHaveBeenCalledWith('ALT-TEST1');
    expect(h.store.order?.status).toBe('paid');
  });

  it('повторное уведомление о том же платеже: второй вызов processPaidOrder не делается', async () => {
    const h = makeHarness({ payment: succeededPayment });
    await handleYooKassaNotification(succeededNotification, h.deps);
    const again = await handleYooKassaNotification(succeededNotification, h.deps);

    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ alreadyPaid: true });
    expect(h.deps.processPaidOrder).toHaveBeenCalledTimes(1);
    expect(h.deps.repairEnrollment).toHaveBeenCalledWith('ALT-TEST1');
  });

  it('второй платёж по уже оплаченному заказу — доступ не дублируется, первый платёж не перезаписан, сигнал о двойной оплате', async () => {
    const h = makeHarness({
      payment: { ...succeededPayment, id: 'pay-2' },
      order: { status: 'paid', providerPaymentId: 'pay-1' },
    });
    const res = await handleYooKassaNotification({ ...succeededNotification, object: { id: 'pay-2' } }, h.deps);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ alreadyPaid: true, doublePayment: true });
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
    expect(h.deps.attachPayment).not.toHaveBeenCalled();
    expect(h.store.order?.providerPaymentId).toBe('pay-1');
    expect(h.deps.alert).toHaveBeenCalledTimes(1);
  });

  it('сумма платежа не совпала с заказом — отклоняем, побочные эффекты не выполняются', async () => {
    const h = makeHarness({
      payment: { ...succeededPayment, amount: { value: '4999.00', currency: 'RUB' } },
    });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: false, error: 'Amount mismatch' });
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
    expect(h.deps.markPaymentLinkPaid).not.toHaveBeenCalled();
    expect(h.deps.attachPayment).not.toHaveBeenCalled();
    expect(h.store.order?.status).toBe('pending');
  });

  it('валюта не RUB — отклоняем', async () => {
    const h = makeHarness({
      payment: { ...succeededPayment, amount: { value: '5000.00', currency: 'USD' } },
    });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: false, error: 'Amount mismatch' });
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
  });

  it('статус платежа в API не succeeded (уведомление устарело) — заказ не трогаем', async () => {
    const h = makeHarness({ payment: { ...succeededPayment, status: 'pending', paid: false } });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skipped: 'not succeeded' });
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
  });

  it('неизвестный заказ — 200, без обработки, админу уходит сигнал', async () => {
    const h = makeHarness({ payment: succeededPayment, order: null });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ skipped: 'order not found' });
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
    expect(h.deps.alert).toHaveBeenCalled();
  });

  it('платёж без metadata.orderNumber — заказ не определить, обработки нет', async () => {
    const h = makeHarness({ payment: { ...succeededPayment, metadata: {} } });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);
    expect(res.status).toBe(200);
    expect(h.deps.findOrder).not.toHaveBeenCalled();
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
  });

  it('сбой перечитывания платежа через API — 502, чтобы ЮKassa повторила уведомление', async () => {
    const h = makeHarness({ payment: succeededPayment, fetchError: new Error('timeout') });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);
    expect(res.status).toBe(502);
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
  });

  it('processPaidOrder вернул ошибку — 500 для повторной доставки', async () => {
    const h = makeHarness({ payment: succeededPayment, processOk: false });
    const res = await handleYooKassaNotification(succeededNotification, h.deps);
    expect(res.status).toBe(500);
  });

  it('payment.canceled: pending-заказ переводится в cancelled', async () => {
    const h = makeHarness({
      payment: {
        id: 'pay-2',
        status: 'canceled',
        paid: false,
        amount: { value: '5000.00', currency: 'RUB' },
        metadata: { orderNumber: 'ALT-TEST1' },
        cancellation_details: { party: 'payment_network', reason: 'card_expired' },
      },
    });
    const res = await handleYooKassaNotification(
      { type: 'notification', event: 'payment.canceled', object: { id: 'pay-2' } },
      h.deps
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cancelled: true });
    expect(h.store.order?.status).toBe('cancelled');
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
  });

  it('payment.canceled для уже оплаченного заказа статус не меняет', async () => {
    const h = makeHarness({
      order: { status: 'paid', providerPaymentId: 'pay-1' },
      payment: {
        id: 'pay-2',
        status: 'canceled',
        paid: false,
        amount: { value: '5000.00', currency: 'RUB' },
        metadata: { orderNumber: 'ALT-TEST1' },
      },
    });
    const res = await handleYooKassaNotification(
      { type: 'notification', event: 'payment.canceled', object: { id: 'pay-2' } },
      h.deps
    );
    expect(res.body).toMatchObject({ cancelled: false });
    expect(h.store.order?.status).toBe('paid');
  });

  it('refund.succeeded: только журнал; если в ЮKassa возвращено больше, чем учтено — сигнал админу', async () => {
    const h = makeHarness({
      order: { status: 'paid', refundedAmountRub: 0 },
      payment: {
        ...succeededPayment,
        status: 'succeeded',
        refunded_amount: { value: '5000.00', currency: 'RUB' },
      },
    });
    const res = await handleYooKassaNotification(
      {
        type: 'notification',
        event: 'refund.succeeded',
        object: { id: 'ref-1', payment_id: 'pay-1', status: 'succeeded' },
      },
      h.deps
    );
    expect(res.status).toBe(200);
    expect(h.deps.fetchPayment).toHaveBeenCalledWith('pay-1');
    expect(h.deps.processPaidOrder).not.toHaveBeenCalled();
    expect(h.deps.alert).toHaveBeenCalledWith('attention', expect.any(Array));
  });

  it('прочие события игнорируются с 200', async () => {
    const h = makeHarness({ payment: succeededPayment });
    const res = await handleYooKassaNotification(
      { type: 'notification', event: 'payout.succeeded', object: { id: 'po-1' } },
      h.deps
    );
    expect(res.status).toBe(200);
    expect(h.deps.fetchPayment).not.toHaveBeenCalled();
  });

  it('некорректное тело — 400', async () => {
    const h = makeHarness({ payment: succeededPayment });
    expect((await handleYooKassaNotification({ foo: 1 }, h.deps)).status).toBe(400);
    expect((await handleYooKassaNotification(null, h.deps)).status).toBe(400);
  });
});
