/**
 * Быстрая проверка соответствия базовым правилам протокола PayKeeper.
 * Запуск: npx tsx scripts/paykeeper-protocol-check.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildPayKeeperInvoiceParams,
  buildPayKeeperWebhookResponse,
  formatPayKeeperConnectionError,
  normalizePayKeeperServer,
  parsePayKeeperInvoiceResponse,
  parsePayKeeperToken,
  validatePayKeeperWebhook,
} from '../lib/paykeeper';

const secret = 'secret-word';
const params = {
  id: '123',
  sum: '25000.00',
  clientid: 'student@test.local',
  orderid: 'ALT-ORDER-1',
};
const key = crypto
  .createHash('md5')
  .update(`${params.id}${params.sum}${params.clientid}${params.orderid}${secret}`)
  .digest('hex');

assert.equal(normalizePayKeeperServer('https://demo.paykeeper.ru/'), 'demo.paykeeper.ru');
assert.equal(parsePayKeeperToken('{"token":"abc123"}'), 'abc123');
assert.equal(parsePayKeeperInvoiceResponse('{"invoice_id":"inv-42"}', 'demo.paykeeper.ru'), 'https://demo.paykeeper.ru/bill/inv-42/');
const invoiceParams = buildPayKeeperInvoiceParams({
  sum: 25000,
  orderid: 'ALT-ORDER-1',
  clientid: 'student@test.local',
  service_name: 'AVATERRA — Курс',
  client_email: 'student@test.local',
}, 'token-1');
assert.equal(invoiceParams.get('pay_amount'), '25000');
assert.equal(invoiceParams.has('sum'), false);
assert.equal(validatePayKeeperWebhook({ ...params, key }, secret), true);
assert.equal(
  buildPayKeeperWebhookResponse(params.id, secret),
  `OK ${crypto.createHash('md5').update(`${params.id}${secret}`).digest('hex')}`,
);
assert.match(
  formatPayKeeperConnectionError(new Error('fetch failed', { cause: { code: 'ENOTFOUND' } }), 'missing.example'),
  /Не удалось найти сервер PayKeeper: missing\.example/,
);

console.log('PayKeeper protocol checks passed');
