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
import { maskEmailForLog, sanitizePayloadForPaykeeperLog } from '../lib/paykeeper-integration-log';

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
assert.equal(
  parsePayKeeperInvoiceResponse(
    '{"invoice_id":"x1","invoice_url":"https://pk.example.com/bill/x1/"}',
    'demo.paykeeper.ru'
  ),
  'https://pk.example.com/bill/x1/'
);
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

const emptyClient = { id: '123', sum: '100.00', clientid: '', orderid: 'ALT-2', key: '' };
emptyClient.key = crypto
  .createHash('md5')
  .update(`${emptyClient.id}${emptyClient.sum}${emptyClient.clientid}${emptyClient.orderid}${secret}`)
  .digest('hex');
assert.equal(validatePayKeeperWebhook(emptyClient, secret), true);

const decSum = { ...params, sum: '1999.50' };
const decKey = crypto
  .createHash('md5')
  .update(`${decSum.id}${decSum.sum}${decSum.clientid}${decSum.orderid}${secret}`)
  .digest('hex');
assert.equal(validatePayKeeperWebhook({ ...decSum, key: decKey }, secret), true);
assert.equal(validatePayKeeperWebhook({ ...params, key: 'deadbeef' }, secret), false);

assert.equal(
  buildPayKeeperWebhookResponse(params.id, secret),
  `OK ${crypto.createHash('md5').update(`${params.id}${secret}`).digest('hex')}`,
);

assert.match(maskEmailForLog('student@test.local'), /^st\*\*\*@test\.local$/);

const sanitized = sanitizePayloadForPaykeeperLog({
  paykeeper_password: 'x',
  paykeeper_secret: 'y',
  orderid: 'ALT-1',
  opaque_hex: 'abcdef0123456789abcdef0123456789',
  key: 'a1b2c3d4e5f678901234567890abcdef',
  nested: { Authorization: 'Basic xxx' },
});
assert.equal(sanitized?.paykeeper_password, '[redacted]');
assert.equal(sanitized?.paykeeper_secret, '[redacted]');
assert.equal(sanitized?.orderid, 'ALT-1');
assert.equal(sanitized?.opaque_hex, '[looks_like_token]');
assert.match(String(sanitized?.key), /^[a-f0-9]{8}…$/i);
assert.match(
  formatPayKeeperConnectionError(new Error('fetch failed', { cause: { code: 'ENOTFOUND' } }), 'missing.example'),
  /Не удалось найти сервер PayKeeper: missing\.example/,
);
assert.match(
  formatPayKeeperConnectionError(new Error('fetch failed', { cause: { code: 'EAI_AGAIN' } }), 'slow-dns.example'),
  /DNS временно не ответил для PayKeeper: slow-dns\.example/,
);

console.log('PayKeeper protocol checks passed');
