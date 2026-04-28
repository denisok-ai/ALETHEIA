/**
 * Выставление счёта PayKeeper (/change/invoice/preview/).
 */

import { paykeeperHttp } from '@/lib/paykeeper/http';
import { requirePayKeeperConfig } from '@/lib/paykeeper/config';
import { parsePayKeeperInvoiceResponse } from '@/lib/paykeeper/parse';
import type { CreatePayKeeperInvoiceResult, PaymentData } from '@/lib/paykeeper/types';
import {
  maskEmailForLog,
  writePaykeeperIntegrationLog,
} from '@/lib/paykeeper-integration-log';

export function buildPayKeeperInvoiceParams(data: PaymentData, token: string): URLSearchParams {
  const serviceNameField =
    typeof data.service_name === 'string'
      ? data.service_name
      : JSON.stringify(data.service_name);

  const form = new URLSearchParams({
    pay_amount: String(data.sum),
    orderid: data.orderid,
    clientid: data.clientid,
    service_name: serviceNameField,
    client_email: data.client_email,
    token,
  });
  if (data.client_phone) form.set('client_phone', data.client_phone);
  // Если service_name — JSON-объект, user_result_callback уже может быть внутри; иначе дублируем полем формы.
  if (data.successRedirectUrl && typeof data.service_name === 'string') {
    form.set('user_result_callback', data.successRedirectUrl);
  }
  return form;
}

export async function createPayKeeperInvoice(data: PaymentData): Promise<CreatePayKeeperInvoiceResult> {
  const config = await requirePayKeeperConfig();
  const { server } = config;

  await writePaykeeperIntegrationLog({
    direction: 'outbound',
    event: 'invoice.flow',
    status: 'success',
    orderNumber: data.orderid,
    message: 'Старт: создание счёта (HTTP-клиент)',
    payload: {
      server,
      orderid: data.orderid,
      pay_amount: data.sum,
      client_email: maskEmailForLog(data.client_email),
    },
  });

  const body = new URLSearchParams({
    pay_amount: String(data.sum),
    orderid: data.orderid,
    clientid: data.clientid,
    service_name:
      typeof data.service_name === 'string'
        ? data.service_name
        : JSON.stringify(data.service_name),
    client_email: data.client_email,
  });
  if (data.client_phone) body.set('client_phone', data.client_phone);
  if (data.successRedirectUrl && typeof data.service_name === 'string') {
    body.set('user_result_callback', data.successRedirectUrl);
  }

  let text: string;
  let status: number;
  try {
    const res = await paykeeperHttp(config, {
      method: 'POST',
      path: '/change/invoice/preview/',
      body,
      logContext: 'invoice.preview',
    });
    text = res.text;
    status = res.status;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'invoice.create',
      status: 'error',
      orderNumber: data.orderid,
      message: msg.slice(0, 500),
    });
    throw e;
  }

  if (status < 200 || status >= 300) {
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'invoice.create',
      status: 'error',
      orderNumber: data.orderid,
      httpStatus: status,
      message: 'PayKeeper create invoice HTTP error',
      payload: { server, responseSnippet: text.slice(0, 800) },
    });
    throw new Error(`PayKeeper create invoice failed: HTTP ${status}`);
  }

  const parsed = parsePayKeeperInvoiceResponse(text, server);
  await writePaykeeperIntegrationLog({
    direction: 'outbound',
    event: 'invoice.created',
    status: 'success',
    orderNumber: data.orderid,
    invoiceUrl: parsed.invoiceUrl,
    message: 'Счёт создан, invoice_url',
    payload: {
      server,
      invoiceId: parsed.invoiceId,
      paymentUrl: parsed.invoiceUrl,
      responseSnippet: text.trim().slice(0, 300),
    },
  });

  return { paymentUrl: parsed.invoiceUrl, invoiceId: parsed.invoiceId };
}
