/** Обёртки GA4 (purchase, generate_lead): имена событий, параметры, отсутствие ПДн, дедупликация покупки. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS, claimOnce, trackGa4Lead, trackGa4Purchase, type LeadType } from '@/lib/analytics-events';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const PURCHASE = { transactionId: 'AV-T-1', valueRub: 3900, itemId: 'kurs-1', itemName: 'Курс' };

describe('аналитика: обёртки GA4', () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    gtag = vi.fn();
    vi.stubGlobal('window', { gtag, ym: vi.fn() });
    vi.stubGlobal('localStorage', memoryStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('trackGa4Lead шлёт generate_lead с lead_type, value 0 и валютой RUB', () => {
    trackGa4Lead('waitlist');
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'generate_lead', {
      lead_type: 'waitlist',
      value: 0,
      currency: 'RUB',
    });
  });

  it('в параметрах лида нет имени, email, телефона и текста при любом типе заявки', () => {
    const types: LeadType[] = ['waitlist', 'chat', 'checkout_request', 'first_test'];
    for (const type of types) trackGa4Lead(type);
    expect(gtag).toHaveBeenCalledTimes(types.length);
    for (const call of gtag.mock.calls) {
      const params = call[2] as Record<string, unknown>;
      expect(Object.keys(params).sort()).toEqual(['currency', 'lead_type', 'value']);
      for (const forbidden of ['email', 'name', 'phone', 'contact', 'message', 'question']) {
        expect(params).not.toHaveProperty(forbidden);
      }
    }
  });

  it('trackGa4Purchase шлёт purchase с номером заказа, суммой в рублях и товаром', () => {
    trackGa4Purchase(PURCHASE);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'purchase', {
      transaction_id: 'AV-T-1',
      value: 3900,
      currency: 'RUB',
      items: [{ item_id: 'kurs-1', item_name: 'Курс', price: 3900, quantity: 1 }],
    });
  });

  it('без названия товара в items уходит item_id вместо item_name', () => {
    trackGa4Purchase({ ...PURCHASE, itemName: null });
    expect(gtag.mock.calls[0]?.[2]).toMatchObject({
      items: [{ item_id: 'kurs-1', item_name: 'kurs-1', price: 3900, quantity: 1 }],
    });
  });

  it('сумма 0 (бесплатный доступ) не уходит как покупка', () => {
    trackGa4Purchase({ ...PURCHASE, valueRub: 0 });
    expect(gtag).not.toHaveBeenCalled();
  });

  it('повтор покупки по тому же заказу (перезагрузка /success) не уходит', () => {
    trackGa4Purchase(PURCHASE);
    trackGa4Purchase(PURCHASE);
    trackGa4Purchase(PURCHASE);
    expect(gtag.mock.calls.filter((call) => call[1] === 'purchase')).toHaveLength(1);
  });

  it('разные заказы уходят каждый по одному разу', () => {
    trackGa4Purchase(PURCHASE);
    trackGa4Purchase({ ...PURCHASE, transactionId: 'AV-T-2' });
    const ids = gtag.mock.calls.map((call) => (call[2] as { transaction_id: string }).transaction_id);
    expect(ids).toEqual(['AV-T-1', 'AV-T-2']);
  });

  it('отметка Метрики по заказу не блокирует покупку в GA4', () => {
    claimOnce('ym_paid_AV-T-1');
    trackGa4Purchase(PURCHASE);
    expect(gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({ transaction_id: 'AV-T-1' }));
  });

  it('без доступного localStorage покупка всё равно уходит (лучше дубль, чем потеря)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage denied');
      },
      setItem: () => {
        throw new Error('storage denied');
      },
    });
    trackGa4Purchase(PURCHASE);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('claimOnce: первый вызов по ключу true, повтор false', () => {
    expect(claimOnce('k')).toBe(true);
    expect(claimOnce('k')).toBe(false);
    expect(claimOnce('other')).toBe(true);
  });

  it('вне production ни лид, ни покупка не отправляются', () => {
    vi.stubEnv('NODE_ENV', 'development');
    trackGa4Lead('chat');
    trackGa4Purchase(PURCHASE);
    expect(gtag).not.toHaveBeenCalled();
  });

  it('без gtag на странице вызовы не падают', () => {
    vi.stubGlobal('window', {});
    expect(() => trackGa4Lead('first_test')).not.toThrow();
    expect(() => trackGa4Purchase(PURCHASE)).not.toThrow();
  });

  it('имена событий GA4 соответствуют рекомендуемым', () => {
    expect(ANALYTICS.PURCHASE).toBe('purchase');
    expect(ANALYTICS.GENERATE_LEAD).toBe('generate_lead');
  });
});
