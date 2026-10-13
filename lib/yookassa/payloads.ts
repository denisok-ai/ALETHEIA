/**
 * Чистые построители тел запросов ЮKassa (без сети и БД — покрыты unit-тестами).
 */
import type {
  YooKassaCreatePaymentBody,
  YooKassaReceipt,
  YooKassaReceiptSettings,
} from '@/lib/yookassa/types';

/** Лимит ЮKassa на description товара в чеке и описание платежа. */
export const RECEIPT_DESCRIPTION_MAX = 128;

/** tax_system_code: 1 ОСН, 2 УСН «доходы», 3 УСН «доходы минус расходы», 4 ЕНВД, 5 ЕСХН, 6 патент. */
export const TAX_SYSTEM_CODES = [1, 2, 3, 4, 5, 6] as const;
/** vat_code: 1 без НДС, 2..12 — ставки НДС (справочник ЮKassa, коды 1–12). */
export const VAT_CODES = Array.from({ length: 12 }, (_, i) => i + 1);
/** payment_subject — признак предмета расчёта (подмножество справочника ЮKassa). */
export const PAYMENT_SUBJECTS = [
  'commodity',
  'excise',
  'job',
  'service',
  'payment',
  'agent_commission',
  'property_right',
  'non_operating_gain',
  'intellectual_activity',
  'another',
] as const;
/** payment_mode — признак способа расчёта (справочник ЮKassa). */
export const PAYMENT_MODES = [
  'full_prepayment',
  'partial_prepayment',
  'advance',
  'full_payment',
  'partial_payment',
  'credit',
  'credit_payment',
] as const;

/** Сумма в рублях (целое) → строка «5000.00» для ЮKassa. */
export function formatRubAmount(rub: number): string {
  if (!Number.isFinite(rub) || rub <= 0) {
    throw new Error(`ЮKassa: сумма должна быть положительным числом, получено ${rub}`);
  }
  return rub.toFixed(2);
}

/**
 * Обрезка названия до лимита ЮKassa (128 символов). Считаем по кодовым точкам,
 * чтобы не разрезать суррогатные пары. Пустое название → «Услуга».
 */
export function trimReceiptDescription(text: string, max: number = RECEIPT_DESCRIPTION_MAX): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const cut = Array.from(normalized).slice(0, max).join('').trim();
  return cut || 'Услуга';
}

export function buildReceipt(input: {
  email: string;
  productName: string;
  amountRub: number;
  settings: YooKassaReceiptSettings;
}): YooKassaReceipt {
  const { settings } = input;
  return {
    customer: { email: input.email.trim() },
    tax_system_code: settings.taxSystemCode,
    items: [
      {
        description: trimReceiptDescription(input.productName),
        quantity: 1,
        amount: { value: formatRubAmount(input.amountRub), currency: 'RUB' },
        vat_code: settings.vatCode,
        payment_subject: settings.paymentSubject,
        payment_mode: settings.paymentMode,
      },
    ],
  };
}

/**
 * Тело POST /v3/payments. Оплата списывается сразу (capture: true), клиент уходит
 * на confirmation_url и возвращается на returnUrl. Заказ связывается через metadata.orderNumber.
 */
export function buildCreatePaymentBody(input: {
  orderNumber: string;
  amountRub: number;
  productName: string;
  email: string;
  returnUrl: string;
  receipts: YooKassaReceiptSettings;
}): YooKassaCreatePaymentBody {
  const body: YooKassaCreatePaymentBody = {
    amount: { value: formatRubAmount(input.amountRub), currency: 'RUB' },
    capture: true,
    confirmation: { type: 'redirect', return_url: input.returnUrl },
    description: trimReceiptDescription(`Заказ ${input.orderNumber}`),
    metadata: { orderNumber: input.orderNumber },
  };
  if (input.receipts.enabled) {
    body.receipt = buildReceipt({
      email: input.email,
      productName: input.productName,
      amountRub: input.amountRub,
      settings: input.receipts,
    });
  }
  return body;
}
