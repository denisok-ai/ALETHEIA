/**
 * Возвраты PayKeeper (/change/payment/reverse/).
 */

import type { PayKeeperConfig } from '@/lib/paykeeper/types';
import { paykeeperHttp } from '@/lib/paykeeper/http';

export type ReversePaymentInput = {
  paymentId: string;
  /** Сумма в рублях с копейками, строка с точкой — как в доке PayKeeper. */
  amount: string;
  partial: boolean;
  refund_cart?: string;
};

export async function reversePayment(
  cfg: PayKeeperConfig,
  input: ReversePaymentInput
): Promise<void> {
  const body = new URLSearchParams({
    id: input.paymentId,
    amount: input.amount,
    partial: input.partial ? 'true' : 'false',
  });
  if (input.refund_cart) body.set('refund_cart', input.refund_cart);

  const { text, status, json } = await paykeeperHttp(cfg, {
    method: 'POST',
    path: '/change/payment/reverse/',
    body,
    logContext: 'payment.reverse',
  });
  if (status < 200 || status >= 300) {
    throw new Error(`PayKeeper reverse HTTP ${status}: ${text.slice(0, 300)}`);
  }
  if (json && typeof json === 'object' && (json as { result?: string }).result !== 'success') {
    throw new Error(text.slice(0, 400));
  }
}
