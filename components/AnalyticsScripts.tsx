/**
 * Заглушка: ничего не рендерит и не грузит. Счётчики подключает components/SiteAnalytics.tsx
 * (Google Analytics 4 и Microsoft Clarity; Clarity грузится, только если задан NEXT_PUBLIC_CLARITY_PROJECT_ID).
 * Компонент нигде не используется.
 */
export function AnalyticsScripts() {
  return null;
}
