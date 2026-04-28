/**
 * Чеки PayKeeper (если методы доступны в кабинете).
 */

import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { paykeeperHttp } from '@/lib/paykeeper/http';

export async function fetchReceiptsByPaymentId(
  cfg: PayKeeperConfig,
  paymentId: string
): Promise<unknown> {
  const { json, text, status } = await paykeeperHttp(cfg, {
    method: 'GET',
    path: '/info/receipts/bypaymentid/',
    query: `id=${encodeURIComponent(paymentId)}`,
    skipFailGuard: true,
    logContext: 'receipts.bypaymentid',
  });
  if (status === 404) return null;
  if (status < 200 || status >= 300) {
    throw new Error(`PayKeeper receipts HTTP ${status}: ${text.slice(0, 200)}`);
  }
  return json;
}

export async function requestReceiptPrint(
  cfg: PayKeeperConfig,
  fields: Record<string, string>
): Promise<unknown> {
  const body = new URLSearchParams(fields);
  const { json, text, status } = await paykeeperHttp(cfg, {
    method: 'POST',
    path: '/change/receipt/print/',
    body,
    skipFailGuard: true,
    logContext: 'receipt.print',
  });
  if (status < 200 || status >= 300) {
    throw new Error(`PayKeeper receipt print HTTP ${status}: ${text.slice(0, 300)}`);
  }
  return json;
}
