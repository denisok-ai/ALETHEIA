/**
 * Ключ и значения согласия на cookie в localStorage (публичный сайт).
 * analytics — разрешена Яндекс.Метрика; essential — только необходимые cookie.
 */
export const COOKIE_CONSENT_STORAGE_KEY = 'avaterra_cookie_consent';

export type CookieConsentValue = 'essential' | 'analytics';

export const COOKIE_CONSENT_EVENT = 'avaterra-cookie-consent';
