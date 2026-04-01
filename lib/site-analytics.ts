/**
 * Публичные идентификаторы счётчиков (видны в HTML). Переопределение через NEXT_PUBLIC_* в .env.
 * На production-сборке счётчики включены; в dev (next dev) — выключены через NODE_ENV.
 */
export function getAnalyticsConfig() {
  const enabled = process.env.NODE_ENV === 'production';
  return {
    enabled,
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-7CQ48S3CFF',
    clarityProjectId: process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || 'w4v3ss4ro9',
    yandexVerification: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION || '0dec6f2dc03cbfd9',
  };
}
