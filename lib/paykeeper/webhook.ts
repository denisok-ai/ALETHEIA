/**
 * Подпись и ответ POST-оповещения PayKeeper.
 */

import crypto from 'crypto';

function strParam(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v);
}

/**
 * Проверка подписи: md5(id + sum + clientid + orderid + secret).
 * clientid/orderid могут быть пустыми строками.
 */
export function validatePayKeeperWebhook(params: Record<string, unknown>, secret: string): boolean {
  const id = strParam(params.id);
  const sum = strParam(params.sum);
  const clientid = strParam(params.clientid);
  const orderid = strParam(params.orderid);
  const key = strParam(params.key);
  if (!id || !sum || !key) return false;
  const hash = crypto
    .createHash('md5')
    .update(`${id}${sum}${clientid}${orderid}${secret}`)
    .digest('hex');
  return hash === key;
}

export function buildPayKeeperWebhookResponse(id: string, secret: string): string {
  const hash = crypto.createHash('md5').update(`${id}${secret}`).digest('hex');
  return `OK ${hash}`;
}
