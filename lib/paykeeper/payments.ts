/**
 * Платежи PayKeeper: поиск, по id, повтор оповещений.
 */

import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { paykeeperHttp } from '@/lib/paykeeper/http';
import {
  normalizePaymentRows,
  type PaykeeperPaymentRow,
  isPaykeeperMoneySettledStatus,
} from '@/lib/paykeeper/parse';

export async function fetchPaymentById(
  cfg: PayKeeperConfig,
  id: string
): Promise<PaykeeperPaymentRow[]> {
  const { json, text, status } = await paykeeperHttp(cfg, {
    method: 'GET',
    path: '/info/payments/byid/',
    query: `id=${encodeURIComponent(id)}`,
    skipFailGuard: true,
    logContext: 'payments.byid',
  });
  if (status < 200 || status >= 300) {
    throw new Error(`PayKeeper byid HTTP ${status}: ${text.slice(0, 200)}`);
  }
  return normalizePaymentRows(json);
}

export async function searchPayments(
  cfg: PayKeeperConfig,
  query: string,
  begDate: string,
  endDate: string
): Promise<PaykeeperPaymentRow[]> {
  const q = [
    `query=${encodeURIComponent(query)}`,
    `beg_date=${encodeURIComponent(begDate)}`,
    `end_date=${encodeURIComponent(endDate)}`,
  ].join('&');
  const { json, text, status } = await paykeeperHttp(cfg, {
    method: 'GET',
    path: '/info/payments/search/',
    query: q,
    skipFailGuard: true,
    logContext: 'payments.search',
  });
  if (status < 200 || status >= 300) {
    throw new Error(`PayKeeper search HTTP ${status}: ${text.slice(0, 200)}`);
  }
  return normalizePaymentRows(json);
}

export async function repeatPaymentNotification(cfg: PayKeeperConfig, paymentId: string): Promise<void> {
  const body = new URLSearchParams({ id: paymentId });
  const { text, status, json } = await paykeeperHttp(cfg, {
    method: 'POST',
    path: '/change/payment/repeatcnt/',
    body,
    skipFailGuard: true,
    logContext: 'payment.repeatcnt',
  });
  if (status < 200 || status >= 300) {
    throw new Error(`PayKeeper repeatcnt HTTP ${status}: ${text.slice(0, 200)}`);
  }
  const ok =
    (Array.isArray(json) &&
      json.some(
        (x) => x && typeof x === 'object' && (x as { result?: string }).result === 'success'
      )) ||
    (json &&
      typeof json === 'object' &&
      !Array.isArray(json) &&
      (json as { result?: string }).result === 'success');
  if (!ok) {
    throw new Error(text.slice(0, 300));
  }
}

export { isPaykeeperMoneySettledStatus };
