/**
 * Google Analytics отключён по умолчанию (снижение рисков трансграничной передачи ПДн, 152-ФЗ).
 * Google-счётчики не подключаются. Яндекс.Метрика грузится для всех из components/YandexMetrika.tsx (layout).
 */
export function GoogleTagInHead() {
  return null;
}
