/**
 * PayKeeper API client.
 * Документация: https://help.paykeeper.ru/
 */

export interface PayKeeperConfig {
  server: string;
  login: string;
  password: string;
  secret: string;
}

export interface PaymentData {
  sum: number;
  orderid: string;
  clientid: string;
  service_name: string;
  client_email: string;
  client_phone?: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

function getConfig(): PayKeeperConfig {
  const server = process.env.PAYKEEPER_SERVER;
  const login = process.env.PAYKEEPER_LOGIN;
  const password = process.env.PAYKEEPER_PASSWORD;
  const secret = process.env.PAYKEEPER_SECRET;
  if (!server || !login || !password || !secret) {
    throw new Error('PayKeeper env vars not set');
  }
  return { server, login, password, secret };
}

/**
 * Создание счёта в PayKeeper. Возвращает URL для редиректа на оплату.
 */
export async function createPayKeeperInvoice(
  data: PaymentData
): Promise<string> {
  const { server, login, password } = getConfig();
  const tokenRes = await fetch(`https://${server}/info/settings/token/`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
    },
  });
  if (!tokenRes.ok) {
    throw new Error('PayKeeper token request failed');
  }
  const token = await tokenRes.text();

  const form = new URLSearchParams({
    sum: String(data.sum),
    orderid: data.orderid,
    clientid: data.clientid,
    service_name: data.service_name,
    client_email: data.client_email,
    token,
  });
  if (data.client_phone) form.set('client_phone', data.client_phone);

  const createRes = await fetch(`https://${server}/change/invoice/preview/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`PayKeeper create invoice failed: ${text}`);
  }
  const html = await createRes.text();
  const match = html.match(/href="(https:\/\/[^"]+\/pay\/[^"]+)"/);
  if (!match) throw new Error('PayKeeper: payment URL not found in response');
  return match[1];
}

/**
 * Проверка подписи webhook от PayKeeper.
 */
export function validatePayKeeperWebhook(
  params: Record<string, unknown>,
  secret: string
): boolean {
  const id = params.id;
  const sum = params.sum;
  const orderid = params.orderid;
  const key = params.key;
  if (typeof id !== 'string' || typeof sum !== 'string' || typeof orderid !== 'string' || typeof key !== 'string') {
    return false;
  }
  const crypto = require('crypto');
  const hash = crypto
    .createHash('md5')
    .update(`${id}|${sum}|${orderid}|${secret}`)
    .digest('hex');
  return hash === key;
}
