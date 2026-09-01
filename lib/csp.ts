/**
 * Единый источник Content-Security-Policy для всех HTML-ответов.
 * Заголовок ставится в `middleware.ts` (не в next.config), потому что политика
 * зависит от маршрута: два CSP-заголовка от next.config + middleware браузер
 * складывает в пересечение, поэтому источник должен быть один.
 *
 * `'unsafe-eval'` выдаётся ТОЧЕЧНО — только на страницу SCORM-плеера
 * (`/portal/student/courses/<id>/play`) и на сам контент курса
 * (`/uploads/scorm/`): webpack-сборки курсов и плеер вызывают eval()/new
 * Function(). Инцидент 31.08.2026: студент проходил «Практик», часть экранов
 * были пустыми, в csp-report висело `script-src blocked=eval`. Остальной сайт
 * остаётся БЕЗ unsafe-eval — послабление не утекает на публичные страницы.
 *
 * Домены аналитики в script-src ОБЯЗАТЕЛЬНЫ: CSP от 10.07.2026 молча
 * заблокировала загрузку скрипта Яндекс.Метрики (счётчик 108390990 показывал
 * нули весь июль). mc.yandex.com — зеркало tag.js; GA (googletagmanager.com) и
 * Clarity (clarity.ms) — включены 12.08.2026. Без этих доменов CSP молча режет
 * счётчики. worker-src blob: — вебвизор Метрики пишет сессии через blob-worker.
 */

const ANALYTICS_SCRIPT_SRC =
  'https://mc.yandex.ru https://mc.yandex.com https://www.googletagmanager.com https://www.clarity.ms https://c.clarity.ms https://scripts.clarity.ms';

/** Маршруты, где контент легитимно вызывает eval() (SCORM-плеер и пакеты курсов). */
export function pathNeedsUnsafeEval(pathname: string): boolean {
  return (
    /^\/portal\/student\/courses\/[^/]+\/play(?:\/|$)/.test(pathname) ||
    pathname.startsWith('/uploads/scorm/')
  );
}

/** Боевая (enforcing) политика. unsafe-eval — только в dev или на SCORM-маршрутах. */
export function buildContentSecurityPolicy(pathname: string, isDev: boolean): string {
  const evalToken = isDev || pathNeedsUnsafeEval(pathname) ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${evalToken} ${ANALYTICS_SCRIPT_SRC}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self' https:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Строгая политика в режиме «только отчёты»: ничего не блокирует, но браузеры
 * присылают на /api/csp-report всё, что нарушило бы запрет 'unsafe-inline' —
 * материал для будущего перехода на nonce. Одинакова на всех маршрутах.
 */
export function buildContentSecurityPolicyReportOnly(): string {
  return [
    "default-src 'self'",
    `script-src 'self' ${ANALYTICS_SCRIPT_SRC}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self' https:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'report-uri /api/csp-report',
  ].join('; ');
}
