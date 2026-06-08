/**
 * Google Analytics отключён по умолчанию (снижение рисков трансграничной передачи ПДн, 152-ФЗ).
 * Счётчики не подключаются из корневого layout. См. CookieConsentBanner + AnalyticsConsentLoader (Яндекс.Метрика после согласия).
 */
export function GoogleTagInHead() {
  return null;
}
