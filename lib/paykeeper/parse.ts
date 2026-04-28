/**
 * Разбор ответов PayKeeper: token, счёт, платёж.
 */

import { normalizePayKeeperServer } from '@/lib/paykeeper/config';

export { parsePayKeeperToken } from '@/lib/paykeeper/token';

export type ParsedInvoice = {
  invoiceId: string;
  invoiceUrl: string;
};

/**
 * Разбор ответа /change/invoice/preview/: приоритет invoice_url из JSON.
 */
export function parsePayKeeperInvoiceResponse(
  responseText: string,
  server: string
): ParsedInvoice {
  const normalizedServer = normalizePayKeeperServer(server);
  const trimmed = responseText.trim();

  try {
    const parsed = JSON.parse(trimmed) as {
      invoice_id?: unknown;
      invoice_url?: unknown;
      result?: unknown;
      msg?: unknown;
    };
    if (parsed.result === 'fail') {
      const msg = typeof parsed.msg === 'string' ? parsed.msg : 'invoice fail';
      throw new Error(`PayKeeper: ${msg}`);
    }
    const idRaw = parsed.invoice_id;
    const id =
      typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw).trim() : '';
    let url = typeof parsed.invoice_url === 'string' ? parsed.invoice_url.trim() : '';
    if (!url && id) {
      url = `https://${normalizedServer}/bill/${encodeURIComponent(id)}/`;
    }
    if (!id && !url) {
      throw new Error('PayKeeper: invoice_id / invoice_url not found in response');
    }
    const invoiceId = id || (() => {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        const billIdx = parts.indexOf('bill');
        if (billIdx >= 0 && parts[billIdx + 1]) return parts[billIdx + 1];
      } catch {
        /* ignore */
      }
      return '';
    })();
    if (!invoiceId) {
      throw new Error('PayKeeper: invoice_id not found in response');
    }
    if (!url) {
      url = `https://${normalizedServer}/bill/${encodeURIComponent(invoiceId)}/`;
    }
    return { invoiceId, invoiceUrl: url };
  } catch (e) {
    if (e instanceof Error && /PayKeeper/.test(e.message)) throw e;
  }

  const match = trimmed.match(/href=["'](https:\/\/[^"']+\/(?:bill|pay)\/[^"']+)["']/);
  if (match) {
    const url = match[1];
    const idMatch = url.match(/\/bill\/([^/?#]+)/);
    const invoiceId = idMatch ? idMatch[1] : '';
    if (invoiceId) return { invoiceId, invoiceUrl: url };
  }
  throw new Error('PayKeeper: invoice_id not found in response');
}

/** Удобная обёртка: только URL оплаты (совместимость со старым API). */
export function parsePayKeeperInvoiceUrl(responseText: string, server: string): string {
  return parsePayKeeperInvoiceResponse(responseText, server).invoiceUrl;
}

export type PaykeeperPaymentRow = {
  id: string;
  pay_amount?: string;
  refund_amount?: string;
  clientid?: string | null;
  orderid?: string | null;
  status?: string;
  repeat_counter?: string;
  [key: string]: unknown;
};

export function normalizePaymentRows(json: unknown): PaykeeperPaymentRow[] {
  if (Array.isArray(json)) {
    return json as PaykeeperPaymentRow[];
  }
  if (json && typeof json === 'object' && json !== null && 'id' in json) {
    return [json as PaykeeperPaymentRow];
  }
  if (json && typeof json === 'object' && 'payment' in json) {
    const p = (json as { payment?: unknown }).payment;
    if (Array.isArray(p)) return p as PaykeeperPaymentRow[];
    if (p && typeof p === 'object') return [p as PaykeeperPaymentRow];
  }
  return [];
}

export function isPaykeeperMoneySettledStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'success' || s === 'obtained' || s === 'stuck';
}

/** Добавить к invoice_url параметры СБП JSON (QR). */
export function appendSbpQrParams(invoiceUrl: string): string {
  const u = new URL(invoiceUrl);
  u.searchParams.set('pstype', 'sbp_default');
  u.searchParams.set('returnFormat', 'json');
  return u.toString();
}

export function rublesFromPkAmount(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
