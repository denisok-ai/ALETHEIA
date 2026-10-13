import { describe, expect, it } from 'vitest';
import {
  buildCreatePaymentBody,
  buildReceipt,
  formatRubAmount,
  trimReceiptDescription,
} from '@/lib/yookassa/payloads';
import { isYooKassaIp } from '@/lib/yookassa/ip';
import { parseYooKassaSettings } from '@/lib/yookassa/config';

const receiptOn = {
  enabled: true,
  taxSystemCode: 2,
  vatCode: 1,
  paymentSubject: 'service',
  paymentMode: 'full_payment',
};

describe('formatRubAmount', () => {
  it('формат «5000.00» для целой суммы в рублях', () => {
    expect(formatRubAmount(5000)).toBe('5000.00');
    expect(formatRubAmount(1)).toBe('1.00');
  });

  it('отклоняет нулевую, отрицательную и нечисловую сумму', () => {
    expect(() => formatRubAmount(0)).toThrow();
    expect(() => formatRubAmount(-10)).toThrow();
    expect(() => formatRubAmount(Number.NaN)).toThrow();
  });
});

describe('trimReceiptDescription', () => {
  it('обрезает название до 128 символов', () => {
    const long = 'А'.repeat(200);
    const out = trimReceiptDescription(long);
    expect(out).toHaveLength(128);
    expect(out).toBe('А'.repeat(128));
  });

  it('не режет суррогатные пары (эмодзи считаются целиком)', () => {
    const text = '😀'.repeat(130);
    const out = trimReceiptDescription(text);
    expect(Array.from(out)).toHaveLength(128);
    expect(out.endsWith('😀')).toBe(true);
  });

  it('схлопывает пробелы и пустое название заменяет на «Услуга»', () => {
    expect(trimReceiptDescription('  Курс   «Мышечное тестирование» ')).toBe('Курс «Мышечное тестирование»');
    expect(trimReceiptDescription('   ')).toBe('Услуга');
  });
});

describe('buildReceipt', () => {
  it('собирает чек 54-ФЗ с кодами из настроек и email клиента', () => {
    const receipt = buildReceipt({
      email: '  client@example.com ',
      productName: 'Курс',
      amountRub: 5000,
      settings: { ...receiptOn, taxSystemCode: 1, vatCode: 11, paymentSubject: 'commodity' },
    });
    expect(receipt).toEqual({
      customer: { email: 'client@example.com' },
      tax_system_code: 1,
      items: [
        {
          description: 'Курс',
          quantity: 1,
          amount: { value: '5000.00', currency: 'RUB' },
          vat_code: 11,
          payment_subject: 'commodity',
          payment_mode: 'full_payment',
        },
      ],
    });
  });

  it('обрезает название товара в позиции чека до 128', () => {
    const receipt = buildReceipt({
      email: 'a@b.ru',
      productName: 'Я'.repeat(300),
      amountRub: 10,
      settings: receiptOn,
    });
    expect(receipt.items[0].description).toHaveLength(128);
  });
});

describe('buildCreatePaymentBody', () => {
  const base = {
    orderNumber: 'ALT-ABC123',
    amountRub: 5000,
    productName: 'Курс «Тест»',
    email: 'client@example.com',
    returnUrl: 'https://avaterra.pro/success?order=ALT-ABC123',
  };

  it('сумма, валюта, capture, redirect и metadata.orderNumber', () => {
    const body = buildCreatePaymentBody({ ...base, receipts: { ...receiptOn, enabled: false } });
    expect(body.amount).toEqual({ value: '5000.00', currency: 'RUB' });
    expect(body.capture).toBe(true);
    expect(body.confirmation).toEqual({
      type: 'redirect',
      return_url: 'https://avaterra.pro/success?order=ALT-ABC123',
    });
    expect(body.metadata).toEqual({ orderNumber: 'ALT-ABC123' });
    expect(body.description).toBe('Заказ ALT-ABC123');
  });

  it('без чеков поле receipt отсутствует', () => {
    const body = buildCreatePaymentBody({ ...base, receipts: { ...receiptOn, enabled: false } });
    expect('receipt' in body).toBe(false);
  });

  it('при включённых чеках добавляет receipt с email клиента', () => {
    const body = buildCreatePaymentBody({ ...base, receipts: receiptOn });
    expect(body.receipt?.customer.email).toBe('client@example.com');
    expect(body.receipt?.items[0].amount.value).toBe('5000.00');
  });
});

describe('isYooKassaIp', () => {
  it('принимает адреса из официального списка уведомлений', () => {
    expect(isYooKassaIp('185.71.76.5')).toBe(true);
    expect(isYooKassaIp('185.71.77.31')).toBe(true);
    expect(isYooKassaIp('77.75.153.100')).toBe(true);
    expect(isYooKassaIp('77.75.156.11')).toBe(true);
    expect(isYooKassaIp('77.75.156.35')).toBe(true);
    expect(isYooKassaIp('77.75.154.200')).toBe(true);
    expect(isYooKassaIp('2a02:5180:1::1')).toBe(true);
  });

  it('отклоняет чужие и граничные адреса', () => {
    expect(isYooKassaIp('185.71.76.40')).toBe(false); // вне /27
    expect(isYooKassaIp('77.75.156.12')).toBe(false);
    expect(isYooKassaIp('77.75.154.127')).toBe(false); // вне /25 (128–255)
    expect(isYooKassaIp('2a02:5181::1')).toBe(false);
    expect(isYooKassaIp('8.8.8.8')).toBe(false);
    expect(isYooKassaIp('')).toBe(false);
    expect(isYooKassaIp(null)).toBe(false);
    expect(isYooKassaIp('not-an-ip')).toBe(false);
  });
});

describe('parseYooKassaSettings', () => {
  const plain = (v: string) => `plain:${v}`;
  const decrypt = (v: string) => {
    if (!v.startsWith('plain:')) throw new Error('bad');
    return v.slice('plain:'.length);
  };

  it('боевой режим: shopId и расшифрованный секрет; тестовые поля не используются', () => {
    const cfg = parseYooKassaSettings(
      {
        yookassa_shop_id: '100500',
        yookassa_secret_key: plain('live-secret'),
        yookassa_test_shop_id: '999',
        yookassa_test_secret_key: plain('test-secret'),
      },
      decrypt
    );
    expect(cfg).toMatchObject({ shopId: '100500', secretKey: 'live-secret', test: false });
  });

  it('yookassa_use_test=1 переключает на тестовый магазин', () => {
    const cfg = parseYooKassaSettings(
      {
        yookassa_use_test: '1',
        yookassa_shop_id: '100500',
        yookassa_secret_key: plain('live-secret'),
        yookassa_test_shop_id: '999',
        yookassa_test_secret_key: plain('test-secret'),
      },
      decrypt
    );
    expect(cfg).toMatchObject({ shopId: '999', secretKey: 'test-secret', test: true });
  });

  it('без секрета или shopId конфиг не собирается', () => {
    expect(parseYooKassaSettings({ yookassa_shop_id: '1' }, decrypt)).toBeNull();
    expect(parseYooKassaSettings({ yookassa_secret_key: plain('x') }, decrypt)).toBeNull();
    expect(
      parseYooKassaSettings({ yookassa_shop_id: '1', yookassa_secret_key: 'corrupted' }, decrypt)
    ).toBeNull();
  });

  it('значения по умолчанию: УСН «доходы» (2), без НДС (1), service, full_payment, чеки выключены', () => {
    const cfg = parseYooKassaSettings(
      { yookassa_shop_id: '1', yookassa_secret_key: plain('s') },
      decrypt
    );
    expect(cfg?.receipts).toEqual({
      enabled: false,
      taxSystemCode: 2,
      vatCode: 1,
      paymentSubject: 'service',
      paymentMode: 'full_payment',
    });
    expect(cfg?.ipCheck).toBe(false);
    expect(cfg?.returnUrlBase).toBeNull();
  });

  it('некорректные коды заменяются значениями по умолчанию', () => {
    const cfg = parseYooKassaSettings(
      {
        yookassa_shop_id: '1',
        yookassa_secret_key: plain('s'),
        yookassa_receipts_enabled: 'true',
        yookassa_tax_system_code: '9',
        yookassa_vat_code: '13',
        yookassa_payment_subject: 'drugs',
        yookassa_payment_mode: 'weird',
        yookassa_return_url: 'https://avaterra.pro/',
        yookassa_ip_check: '1',
      },
      decrypt
    );
    expect(cfg?.receipts).toEqual({
      enabled: true,
      taxSystemCode: 2,
      vatCode: 1,
      paymentSubject: 'service',
      paymentMode: 'full_payment',
    });
    expect(cfg?.returnUrlBase).toBe('https://avaterra.pro');
    expect(cfg?.ipCheck).toBe(true);
  });
});
