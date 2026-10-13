/**
 * Методы ЮKassa API v3, которые использует портал: создание платежа, чтение платежа,
 * возврат, информация о магазине (GET /me).
 */
import { yookassaRequest, type YooKassaCredentials } from '@/lib/yookassa/http';
import type { YooKassaCreatePaymentBody, YooKassaPayment } from '@/lib/yookassa/types';
import { formatRubAmount } from '@/lib/yookassa/payloads';

/** POST /payments. Повтор с тем же ключом вернёт уже созданный платёж. */
export function createYooKassaPayment(
  creds: YooKassaCredentials,
  body: YooKassaCreatePaymentBody,
  idempotenceKey: string,
  fetchImpl?: typeof fetch
): Promise<YooKassaPayment> {
  return yookassaRequest<YooKassaPayment>(creds, {
    method: 'POST',
    path: '/payments',
    body,
    idempotenceKey,
    fetchImpl,
  });
}

/** GET /payments/{id} — единственный источник истины для вебхуков. */
export function fetchYooKassaPayment(
  creds: YooKassaCredentials,
  paymentId: string,
  fetchImpl?: typeof fetch
): Promise<YooKassaPayment> {
  return yookassaRequest<YooKassaPayment>(creds, {
    method: 'GET',
    path: `/payments/${encodeURIComponent(paymentId)}`,
    fetchImpl,
  });
}

/** POST /refunds. Сумма в рублях (целое). */
export function createYooKassaRefund(
  creds: YooKassaCredentials,
  input: { paymentId: string; amountRub: number; description: string; idempotenceKey: string },
  fetchImpl?: typeof fetch
): Promise<{ id: string; status: string; payment_id?: string }> {
  return yookassaRequest(creds, {
    method: 'POST',
    path: '/refunds',
    body: {
      payment_id: input.paymentId,
      amount: { value: formatRubAmount(input.amountRub), currency: 'RUB' },
      description: input.description.slice(0, 250),
    },
    idempotenceKey: input.idempotenceKey,
    fetchImpl,
  });
}

/** GET /me — настройки магазина (проверка подключения; секреты не возвращаются). */
export type YooKassaAccount = {
  account_id: string;
  status?: string;
  test?: boolean;
  payment_methods?: string[];
};

export function fetchYooKassaAccount(
  creds: YooKassaCredentials,
  fetchImpl?: typeof fetch
): Promise<YooKassaAccount> {
  return yookassaRequest<YooKassaAccount>(creds, { method: 'GET', path: '/me', fetchImpl });
}
