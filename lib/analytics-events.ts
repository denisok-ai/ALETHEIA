/**
 * События аналитики. Два счётчика грузятся для всех посетителей в production:
 * Google Analytics 4 — components/SiteAnalytics.tsx (ID из NEXT_PUBLIC_GA_MEASUREMENT_ID);
 * Яндекс.Метрика — components/YandexMetrika.tsx (цели через trackYmGoal).
 * Все отправки идут через обёртки ниже: имена событий и параметры собираются в одном месте.
 */

export const ANALYTICS = {
  PAGE_VIEW_COURSE: 'page_view_course',
  CLICK_ENROLL: 'click_enroll',
  FORM_SUBMIT: 'form_submit',
  SCROLL_PRICING: 'scroll_pricing',
  ENGAGEMENT_2MIN: 'engagement_2min',
  /** Страница /success для оплаченного заказа; с суммой — доход в отчётах Метрики. */
  PAYMENT_SUCCESS: 'payment_success',
  /** Событие GA4 purchase: оплаченный заказ, сумма в рублях. Бесплатный доступ сюда не попадает. */
  PURCHASE: 'purchase',
  /** Событие GA4 generate_lead: заявка, которую сервер принял. Без персональных данных. */
  GENERATE_LEAD: 'generate_lead',
} as const;

/** Тип заявки (параметр lead_type у generate_lead). Имени, контактов и текста здесь нет по определению. */
export type LeadType = 'waitlist' | 'chat' | 'checkout_request' | 'first_test';

function getGtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null;
  const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  return typeof g === 'function' ? g : null;
}

/** GA4 custom event */
export function trackGa4Event(name: string, params?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') return;
  const gtag = getGtag();
  if (gtag) gtag('event', name, params ?? {});
}

/**
 * Цель Яндекс.Метрики. Цели с этими идентификаторами заводит scripts/metrika-ensure-goals.ts —
 * без цели в счётчике Метрика reachGoal молча отбрасывает. params — параметры визита
 * (order_price + currency дают доход в отчётах).
 */
export function trackYmGoal(goal: string, params?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') return;
  const raw = (process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '108390990').trim();
  if (!/^\d+$/.test(raw)) return;
  const ym = (window as unknown as { ym?: (id: number, a: string, b: string, p?: Record<string, unknown>) => void }).ym;
  if (typeof ym === 'function') {
    if (params) ym(Number(raw), 'reachGoal', goal, params);
    else ym(Number(raw), 'reachGoal', goal);
  }
}

/** Дублирование в GA4 и Метрику (имена целей совпадают с ключами событий). */
export function trackGa4AndYm(eventName: string, ymGoal: string, gaParams?: Record<string, unknown>) {
  trackGa4Event(eventName, gaParams);
  trackYmGoal(ymGoal);
}

/**
 * Одноразовая отметка в localStorage: true — отметки не было, событие можно слать;
 * false — уже отправляли (перезагрузка /success, повторный заход по тому же заказу).
 * Без хранилища (приватный режим) отправляем: лучше редкий дубль, чем потерянная оплата.
 */
export function claimOnce(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {
    // Хранилище недоступно (приватный режим) — лучше редкий дубль, чем потерянная оплата.
  }
  return true;
}

/**
 * GA4 purchase по оплаченному заказу. Сумма 0 — бесплатный доступ, это заявка (trackGa4Lead),
 * а не покупка, поэтому не отправляется. Повтор по тому же номеру заказа не уходит:
 * отметка в localStorage отдельная от отметки Метрики.
 */
export function trackGa4Purchase(order: {
  transactionId: string;
  valueRub: number;
  itemId: string;
  itemName: string | null;
}) {
  if (!(order.valueRub > 0)) return;
  if (!claimOnce(`ga4_purchase_${order.transactionId}`)) return;
  trackGa4Event(ANALYTICS.PURCHASE, {
    transaction_id: order.transactionId,
    value: order.valueRub,
    currency: 'RUB',
    items: [
      {
        item_id: order.itemId,
        item_name: order.itemName ?? order.itemId,
        price: order.valueRub,
        quantity: 1,
      },
    ],
  });
}

/**
 * GA4 generate_lead: заявка, которую сервер принял (вызывать только после успешного ответа).
 * В параметрах только тип заявки и нули: имя, email, телефон и текст сообщения сюда не передаются.
 */
export function trackGa4Lead(leadType: LeadType) {
  trackGa4Event(ANALYTICS.GENERATE_LEAD, { lead_type: leadType, value: 0, currency: 'RUB' });
}
