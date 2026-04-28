/**
 * Публичный фасад PayKeeper: конфиг, счета, webhook, HTTP, диагностика.
 * Детали endpoint — docs/PayKeeper-API-Map.md
 */

export type {
  PayKeeperConfig,
  PaymentData,
  PaymentStatus,
  CreatePayKeeperInvoiceResult,
} from '@/lib/paykeeper/types';

export {
  clearPayKeeperConfigCache,
  normalizePayKeeperServer,
  getPayKeeperConfigFromSettings,
  requirePayKeeperConfig,
} from '@/lib/paykeeper/config';

export { PayKeeperApiError, formatPayKeeperConnectionError } from '@/lib/paykeeper/errors';

export { parsePayKeeperToken } from '@/lib/paykeeper/token';

export {
  parsePayKeeperInvoiceUrl,
  isPaykeeperMoneySettledStatus,
  appendSbpQrParams,
  rublesFromPkAmount,
  normalizePaymentRows,
  type ParsedInvoice,
  type PaykeeperPaymentRow,
} from '@/lib/paykeeper/parse';

import { parsePayKeeperInvoiceUrl } from '@/lib/paykeeper/parse';

/** Совместимость со скриптами: только URL оплаты (приоритет invoice_url в JSON). */
export function parsePayKeeperInvoiceResponse(responseText: string, server: string): string {
  return parsePayKeeperInvoiceUrl(responseText, server);
}

export { buildPayKeeperInvoiceParams, createPayKeeperInvoice } from '@/lib/paykeeper/invoices';

export { validatePayKeeperWebhook, buildPayKeeperWebhookResponse } from '@/lib/paykeeper/webhook';

export {
  paykeeperHttp,
  clearTokenCache,
  fetchPayKeeperToken,
  refreshPayKeeperToken,
  assertPayKeeperJsonOk,
} from '@/lib/paykeeper/http';

export {
  fetchPaymentById,
  searchPayments,
  repeatPaymentNotification,
} from '@/lib/paykeeper/payments';

export { reversePayment, type ReversePaymentInput } from '@/lib/paykeeper/refunds';

export { fetchReceiptsByPaymentId, requestReceiptPrint } from '@/lib/paykeeper/receipts';

export { runPaykeeperHealthChecks, type PaykeeperHealthCheck } from '@/lib/paykeeper/diagnostics';

export { syncOrderWithPaykeeper, type SyncOrderResult } from '@/lib/paykeeper/sync-order';

import { requirePayKeeperConfig } from '@/lib/paykeeper/config';
import { refreshPayKeeperToken } from '@/lib/paykeeper/http';
import { formatPayKeeperConnectionError } from '@/lib/paykeeper/errors';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';

/** Проверка подключения: получение токена. */
export async function testPayKeeperConnection(): Promise<{ ok: boolean; error?: string }> {
  let server = '';
  try {
    const config = await requirePayKeeperConfig();
    server = config.server;
    await refreshPayKeeperToken(config);
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'token.test',
      status: 'success',
      message: 'testPayKeeperConnection OK',
      payload: { server },
    });
    return { ok: true };
  } catch (e) {
    const msg = formatPayKeeperConnectionError(e, server);
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'token.test',
      status: 'error',
      message: msg,
      payload: { server: server || '(unknown)' },
    });
    return { ok: false, error: msg };
  }
}
