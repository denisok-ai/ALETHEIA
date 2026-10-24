/**
 * Идентификаторы аналитики. GA4 и Clarity подключает components/SiteAnalytics.tsx (в layout, только в production
 * и только при заданном ID). Яндекс.Метрика — безусловно через components/YandexMetrika.tsx (решение владельца от 24.07.2026).
 */
export function getAnalyticsConfig() {
  const enabled = process.env.NODE_ENV === 'production';
  return {
    enabled,
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || '',
    clarityProjectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || '',
    yandexVerification: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '0dec6f2dc03cbfd9',
    yandexMetrikaId: process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || '108390990',
  };
}
