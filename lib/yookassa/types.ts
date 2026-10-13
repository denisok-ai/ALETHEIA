/**
 * Типы ЮKassa API v3 (только поля, которые использует наш код).
 * Источник: https://yookassa.ru/developers/api (payments, refunds, receipts, me, notifications).
 */

export type YooKassaAmount = { value: string; currency: string };

export type YooKassaPaymentStatus =
  | 'pending'
  | 'waiting_for_capture'
  | 'succeeded'
  | 'canceled'
  | (string & {});

export type YooKassaPayment = {
  id: string;
  status: YooKassaPaymentStatus;
  paid: boolean;
  amount: YooKassaAmount;
  refunded_amount?: YooKassaAmount;
  metadata?: Record<string, string> | null;
  test?: boolean;
  description?: string;
  confirmation?: { type: string; confirmation_url?: string };
  cancellation_details?: { party?: string; reason?: string };
};

/** Входящее HTTP-уведомление: { type: "notification", event, object }. */
export type YooKassaNotification = {
  type: 'notification';
  event: string;
  object: Record<string, unknown> & { id: string };
};

export type YooKassaReceiptItem = {
  description: string;
  quantity: number;
  amount: YooKassaAmount;
  vat_code: number;
  payment_subject: string;
  payment_mode: string;
};

export type YooKassaReceipt = {
  customer: { email: string };
  tax_system_code: number;
  items: YooKassaReceiptItem[];
};

export type YooKassaCreatePaymentBody = {
  amount: YooKassaAmount;
  capture: true;
  confirmation: { type: 'redirect'; return_url: string };
  description: string;
  metadata: { orderNumber: string };
  receipt?: YooKassaReceipt;
};

/** Настройки 54-ФЗ (чеки). Коды — из справочника ЮKassa (см. lib/yookassa/payloads.ts). */
export type YooKassaReceiptSettings = {
  enabled: boolean;
  taxSystemCode: number;
  vatCode: number;
  paymentSubject: string;
  paymentMode: string;
};
