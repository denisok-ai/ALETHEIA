/**
 * Обработка HTTP-уведомлений ЮKassa. Чистая логика: все побочные эффекты (БД, API,
 * processPaidOrder, Telegram) приходят через deps — так её тестируют без сети и БД.
 *
 * Доверие: подписи у уведомлений нет. Поэтому по каждому событию мы ПЕРЕЧИТЫВАЕМ платёж
 * через GET /payments/{id} и принимаем решения только по его данным. Тело уведомления
 * используется лишь для того, чтобы узнать id платежа.
 */
import type { YooKassaNotification, YooKassaPayment } from '@/lib/yookassa/types';

export type WebhookOrder = {
  id: number;
  orderNumber: string;
  status: string;
  amount: number;
  providerPaymentId: string | null;
  refundedAmountRub: number;
};

export type WebhookLogEntry = {
  event: string;
  status: 'success' | 'warning' | 'error';
  orderNumber?: string | null;
  message: string;
  payload?: Record<string, unknown>;
};

export type ProcessPaidOrderOutcome = {
  success: boolean;
  error?: string;
  warnings?: string[];
  enrollmentCreated?: boolean;
  alreadyPaid?: boolean;
};

export type YooKassaWebhookDeps = {
  /** GET /payments/{id}. Бросает исключение при сетевой ошибке / ошибке API. */
  fetchPayment: (paymentId: string) => Promise<YooKassaPayment>;
  findOrder: (orderNumber: string) => Promise<WebhookOrder | null>;
  /** Записывает провайдера и id платежа в заказ (userId НЕ трогает). */
  attachPayment: (orderNumber: string, paymentId: string) => Promise<void>;
  /** Ссылка на персональный товар: pending → paid (как в вебхуке PayKeeper). */
  markPaymentLinkPaid: (orderNumber: string) => Promise<void>;
  /** Общая цепочка оплаты (lib/paykeeper-webhook-process.ts). Идемпотентна сама по себе. */
  processPaidOrder: (orderNumber: string) => Promise<ProcessPaidOrderOutcome>;
  /** Восстановление зачисления для уже оплаченного заказа. */
  repairEnrollment: (orderNumber: string) => Promise<boolean>;
  /** pending → cancelled. Возвращает true, если статус реально изменён. */
  cancelPendingOrder: (orderNumber: string) => Promise<boolean>;
  log: (entry: WebhookLogEntry) => Promise<void>;
  alert: (kind: 'error' | 'attention', lines: string[]) => void;
};

export type WebhookResult = { status: number; body: Record<string, unknown> };

const HANDLED_EVENTS = new Set(['payment.succeeded', 'payment.canceled', 'refund.succeeded']);

export function parseYooKassaNotification(raw: unknown): YooKassaNotification | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== 'notification' || typeof o.event !== 'string') return null;
  const object = o.object;
  if (!object || typeof object !== 'object') return null;
  const id = (object as Record<string, unknown>).id;
  if (typeof id !== 'string' || !id) return null;
  return o as unknown as YooKassaNotification;
}

function amountToKopecks(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function orderNumberFromPayment(payment: YooKassaPayment): string | null {
  const v = payment.metadata?.orderNumber;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function handleYooKassaNotification(
  raw: unknown,
  deps: YooKassaWebhookDeps
): Promise<WebhookResult> {
  const notification = parseYooKassaNotification(raw);
  if (!notification) {
    return { status: 400, body: { error: 'Invalid notification' } };
  }
  if (!HANDLED_EVENTS.has(notification.event)) {
    return { status: 200, body: { ok: true, skipped: notification.event } };
  }

  // Для refund.succeeded id платежа лежит в поле payment_id объекта возврата.
  const paymentId =
    notification.event === 'refund.succeeded'
      ? (typeof notification.object.payment_id === 'string' ? notification.object.payment_id : '')
      : notification.object.id;
  if (!paymentId) {
    await deps.log({
      event: 'yookassa.webhook.no_payment_id',
      status: 'warning',
      message: `Уведомление ${notification.event} без payment_id`,
    });
    return { status: 200, body: { ok: true, skipped: 'no payment id' } };
  }

  let payment: YooKassaPayment;
  try {
    payment = await deps.fetchPayment(paymentId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await deps.log({
      event: 'yookassa.webhook.fetch_failed',
      status: 'error',
      message: `Не удалось перечитать платёж: ${msg.slice(0, 300)}`,
      payload: { event: notification.event, paymentId },
    });
    // 502 — ЮKassa повторит уведомление.
    return { status: 502, body: { error: 'Payment fetch failed' } };
  }

  if (notification.event === 'payment.succeeded') {
    return onSucceeded(payment, deps);
  }
  if (notification.event === 'payment.canceled') {
    return onCanceled(payment, deps);
  }
  return onRefundSucceeded(payment, deps);
}

async function onSucceeded(payment: YooKassaPayment, deps: YooKassaWebhookDeps): Promise<WebhookResult> {
  if (payment.status !== 'succeeded' || payment.paid !== true) {
    await deps.log({
      event: 'yookassa.webhook.not_succeeded',
      status: 'warning',
      message: `Платёж ${payment.id} в статусе «${payment.status}», paid=${String(payment.paid)} — пропущено`,
    });
    return { status: 200, body: { ok: true, skipped: 'not succeeded' } };
  }

  const orderNumber = orderNumberFromPayment(payment);
  if (!orderNumber) {
    await deps.log({
      event: 'yookassa.webhook.no_order_number',
      status: 'error',
      message: `Платёж ${payment.id} без metadata.orderNumber — заказ не определить`,
    });
    deps.alert('attention', [
      'Оплата в ЮKassa без номера заказа — сопоставьте вручную.',
      `Платёж: ${payment.id}`,
    ]);
    return { status: 200, body: { ok: true, skipped: 'no orderNumber' } };
  }

  const order = await deps.findOrder(orderNumber);
  if (!order) {
    await deps.log({
      event: 'yookassa.webhook.order_not_found',
      status: 'error',
      orderNumber,
      message: `Оплата ${payment.id} пришла на неизвестный заказ`,
    });
    deps.alert('attention', [`Оплата ЮKassa на неизвестный заказ ${orderNumber}`, `Платёж: ${payment.id}`]);
    return { status: 200, body: { ok: true, skipped: 'order not found' } };
  }

  const paidKopecks = payment.amount?.currency === 'RUB' ? amountToKopecks(payment.amount.value) : null;
  if (paidKopecks === null || paidKopecks !== order.amount * 100) {
    await deps.log({
      event: 'yookassa.webhook.amount_mismatch',
      status: 'error',
      orderNumber,
      message: `Сумма платежа ${payment.amount?.value} ${payment.amount?.currency} ≠ сумме заказа ${order.amount} ₽`,
      payload: { expectedRub: order.amount, receivedValue: payment.amount?.value, currency: payment.amount?.currency },
    });
    deps.alert('attention', [
      `Сумма оплаты ЮKassa не совпала с заказом ${orderNumber}`,
      `Заказ: ${order.amount} ₽, платёж: ${payment.amount?.value} ${payment.amount?.currency}`,
      'Оплата не проведена — проверьте вручную.',
    ]);
    return { status: 400, body: { error: 'Amount mismatch' } };
  }

  // Повторное уведомление о том же платеже: ничего не проводим повторно.
  if (order.status === 'paid') {
    if (order.providerPaymentId !== payment.id) {
      await deps.attachPayment(orderNumber, payment.id);
    }
    const repaired = await deps.repairEnrollment(orderNumber).catch(() => false);
    await deps.log({
      event: 'yookassa.webhook.idempotent',
      status: 'success',
      orderNumber,
      message: repaired
        ? 'Заказ уже оплачен; отсутствовавшее зачисление восстановлено'
        : 'Заказ уже оплачен — повторная обработка пропущена',
      payload: { paymentId: payment.id, repaired },
    });
    return { status: 200, body: { ok: true, alreadyPaid: true, repaired } };
  }

  await deps.attachPayment(orderNumber, payment.id);
  await deps.markPaymentLinkPaid(orderNumber);

  const result = await deps.processPaidOrder(orderNumber);
  if (!result.success) {
    await deps.log({
      event: 'yookassa.webhook.process_failed',
      status: 'error',
      orderNumber,
      message: result.error ?? 'processPaidOrder failed',
    });
    deps.alert('error', [`Заказ: ${orderNumber}`, `Ошибка: ${result.error ?? 'processPaidOrder failed'}`]);
    // 500 — ЮКасса повторит; processPaidOrder безопасен к повтору.
    return { status: 500, body: { error: result.error ?? 'Processing failed' } };
  }

  if (result.warnings?.length) {
    await deps.log({
      event: 'yookassa.webhook.ok_with_warnings',
      status: 'warning',
      orderNumber,
      message: 'Оплата обработана с предупреждениями',
      payload: { warnings: result.warnings },
    });
    deps.alert('error', [
      `Оплата прошла, но требует внимания. Заказ: ${orderNumber}`,
      `Зачисление: ${result.enrollmentCreated ? 'да' : 'НЕТ'}`,
      ...result.warnings.map((w) => `· ${w}`),
    ]);
  }

  await deps.log({
    event: 'yookassa.webhook.ok',
    status: 'success',
    orderNumber,
    message: 'OK + processPaidOrder',
    payload: {
      paymentId: payment.id,
      enrollmentCreated: result.enrollmentCreated ?? false,
      alreadyPaid: result.alreadyPaid ?? false,
    },
  });
  return { status: 200, body: { ok: true, enrollmentCreated: result.enrollmentCreated ?? false } };
}

async function onCanceled(payment: YooKassaPayment, deps: YooKassaWebhookDeps): Promise<WebhookResult> {
  if (payment.status !== 'canceled') {
    return { status: 200, body: { ok: true, skipped: 'not canceled' } };
  }
  const orderNumber = orderNumberFromPayment(payment);
  if (!orderNumber) {
    await deps.log({
      event: 'yookassa.webhook.canceled_no_order',
      status: 'warning',
      message: `Отмена платежа ${payment.id} без metadata.orderNumber`,
    });
    return { status: 200, body: { ok: true, skipped: 'no orderNumber' } };
  }
  const order = await deps.findOrder(orderNumber);
  if (!order) {
    return { status: 200, body: { ok: true, skipped: 'order not found' } };
  }
  // Оплаченный/возвращённый заказ отменённым платежом не трогаем.
  const cancelled = order.status === 'pending' ? await deps.cancelPendingOrder(orderNumber) : false;
  await deps.log({
    event: 'yookassa.webhook.canceled',
    status: 'warning',
    orderNumber,
    message: cancelled
      ? 'Платёж отменён/не прошёл — заказ переведён в «cancelled»'
      : `Платёж отменён; статус заказа «${order.status}» не изменён`,
    payload: {
      paymentId: payment.id,
      party: payment.cancellation_details?.party ?? null,
      reason: payment.cancellation_details?.reason ?? null,
    },
  });
  return { status: 200, body: { ok: true, cancelled } };
}

async function onRefundSucceeded(payment: YooKassaPayment, deps: YooKassaWebhookDeps): Promise<WebhookResult> {
  const orderNumber = orderNumberFromPayment(payment);
  const refundedRub = Number(payment.refunded_amount?.value ?? 0);
  const order = orderNumber ? await deps.findOrder(orderNumber) : null;
  const knownRub = order?.refundedAmountRub ?? 0;

  await deps.log({
    event: 'yookassa.webhook.refund_succeeded',
    status: 'success',
    orderNumber,
    message: `Возврат по платежу ${payment.id}: всего возвращено ${payment.refunded_amount?.value ?? '0'} ${payment.refunded_amount?.currency ?? 'RUB'}`,
    payload: { paymentId: payment.id, refundedRub },
  });

  // Возврат сделан не из портала (например, в кабинете ЮKassa): сверка с учётом заказа.
  if (order && Number.isFinite(refundedRub) && Math.round(refundedRub) > knownRub) {
    deps.alert('attention', [
      `Возврат по заказу ${order.orderNumber} проведён в ЮKassa, но в портале учтён не полностью`,
      `Возвращено по данным ЮKassa: ${refundedRub} ₽, учтено в портале: ${knownRub} ₽`,
      'Проверьте статус заказа и доступ к курсу.',
    ]);
  }
  return { status: 200, body: { ok: true } };
}
