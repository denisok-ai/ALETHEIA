/**
 * События GA4 (gtag) и цели Яндекс.Метрики — только в production.
 */

export const ANALYTICS = {
  PAGE_VIEW_COURSE: 'page_view_course',
  CLICK_ENROLL: 'click_enroll',
  FORM_SUBMIT: 'form_submit',
  SCROLL_PRICING: 'scroll_pricing',
  ENGAGEMENT_2MIN: 'engagement_2min',
} as const;

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

/** Цель Яндекс.Метрики (задайте те же имена в интерфейсе Метрики). */
export function trackYmGoal(goal: string) {
  if (process.env.NODE_ENV !== 'production') return;
  const raw = (process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '108390990').trim();
  if (!/^\d+$/.test(raw)) return;
  const ym = (window as unknown as { ym?: (id: number, a: string, b: string) => void }).ym;
  if (typeof ym === 'function') ym(Number(raw), 'reachGoal', goal);
}

/** Дублирование в GA4 и Метрику (имена целей совпадают с ключами событий). */
export function trackGa4AndYm(eventName: string, ymGoal: string, gaParams?: Record<string, unknown>) {
  trackGa4Event(eventName, gaParams);
  trackYmGoal(ymGoal);
}
