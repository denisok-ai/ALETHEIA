/**
 * Создание платежа ЮKassa для уже сохранённого заказа (статус pending).
 * Вызывается из /api/payment/create и /api/pay/[token]/checkout при провайдере yookassa.
 */
import { prisma } from '@/lib/db';
import { createYooKassaPayment } from '@/lib/yookassa/client';
import { requireYooKassaConfig } from '@/lib/yookassa/config';
import { buildCreatePaymentBody } from '@/lib/yookassa/payloads';

export type YooKassaCheckoutInput = {
  orderNumber: string;
  amountRub: number;
  /** Название товара — в позиции чека (обрезается до 128 символов). */
  productName: string;
  email: string;
  /** Публичный базовый URL сайта (site_url); для return_url, если в настройках ЮKassa не задан свой. */
  siteBase: string;
  /** Путь возврата после оплаты, например «/success?order=…». */
  returnPath: string;
};

export type YooKassaCheckoutResult = { paymentId: string; confirmationUrl: string };

export async function createYooKassaCheckout(input: YooKassaCheckoutInput): Promise<YooKassaCheckoutResult> {
  const cfg = await requireYooKassaConfig();
  const base = (cfg.returnUrlBase ?? input.siteBase).replace(/\/+$/, '');
  const returnUrl = `${base}${input.returnPath}`;

  const body = buildCreatePaymentBody({
    orderNumber: input.orderNumber,
    amountRub: input.amountRub,
    productName: input.productName,
    email: input.email,
    returnUrl,
    receipts: cfg.receipts,
  });

  // Ключ идемпотентности = номер заказа: повторный запрос по тому же заказу вернёт тот же платёж.
  const payment = await createYooKassaPayment(cfg, body, `yk-${input.orderNumber}`);
  const confirmationUrl = payment.confirmation?.confirmation_url;
  if (!confirmationUrl) {
    throw new Error('ЮKassa не вернула ссылку на оплату');
  }

  await prisma.order.update({
    where: { orderNumber: input.orderNumber },
    data: { paymentProvider: 'yookassa', providerPaymentId: payment.id },
  });

  return { paymentId: payment.id, confirmationUrl };
}
