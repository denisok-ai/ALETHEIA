/**
 * Единая нормализация публичного URL сайта (метаданные, sitemap, robots, JSON-LD).
 */
export function normalizeSiteUrl(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return 'https://avaterra.pro';
  if (!/^https?:\/\//i.test(s)) return `https://${s.replace(/^\/+/, '')}`;
  return s.replace(/\/+$/, '');
}

/**
 * Значение для директивы Host в robots.txt (Яндекс: домен, без схемы; при нестандартном порте — host:port).
 */
export function siteUrlHostForRobots(raw: string): string {
  try {
    return new URL(normalizeSiteUrl(raw)).host;
  } catch {
    return 'avaterra.pro';
  }
}

/** localhost / 127.0.0.1 — для проверок NextAuth и валидации поля nextauth_url в админке. */
export function isLoopbackHostname(host: string): boolean {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

/** Первый не-loopback URL из кандидатов; в production loopback никогда не применяется. */
export function pickPublicSiteUrl(candidates: Array<string | null | undefined>): string {
  const fallback = 'https://avaterra.pro';
  const isProd = process.env.NODE_ENV === 'production';

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      const host = new URL(normalizeSiteUrl(trimmed)).hostname;
      if (isProd && isLoopbackHostname(host)) continue;
      return normalizeSiteUrl(trimmed);
    } catch {
      continue;
    }
  }

  return fallback;
}

/**
 * NextAuth читает `NEXTAUTH_URL` из `process.env` на запросах.
 *
 * **Приоритет источников:** `nextauth_url` в БД (Портал → Настройки) → `site_url` в БД →
 * `NEXT_PUBLIC_URL` → `NEXTAUTH_URL` в `.env`.
 *
 * В `development`, если в БД **нет** поля `nextauth_url`, не подставляем продакшен-`site_url`
 * (иначе next-auth/react: `CLIENT_FETCH_ERROR` при открытии с localhost). Явный `nextauth_url`
 * в БД (например `http://localhost:3000`) в dev применяется всегда.
 */
export function applyNextAuthUrlToProcessEnv(params: {
  explicitNextAuthUrl?: string | null;
  siteUrl?: string | null;
}): void {
  const explicit = params.explicitNextAuthUrl?.trim();
  const site = params.siteUrl?.trim();
  const pub = process.env.NEXT_PUBLIC_URL?.trim() || '';
  const envFallback = process.env.NEXTAUTH_URL?.trim() || '';

  if (process.env.NODE_ENV === 'development') {
    if (explicit) {
      Reflect.set(process.env, 'NEXTAUTH_URL', normalizeSiteUrl(explicit));
      return;
    }
    const raw = site || pub || envFallback;
    if (!raw) return;
    try {
      const host = new URL(normalizeSiteUrl(raw)).hostname;
      if (!isLoopbackHostname(host)) return;
    } catch {
      return;
    }
  }

  const effective = pickPublicSiteUrl([explicit, site, pub, envFallback]);
  const prev = process.env.NEXTAUTH_URL?.trim();
  if (prev !== effective) {
    const hadLoopback = [explicit, site, pub, envFallback].some((c) => {
      if (!c?.trim()) return false;
      try {
        return isLoopbackHostname(new URL(normalizeSiteUrl(c)).hostname);
      } catch {
        return false;
      }
    });
    if (hadLoopback) {
      console.warn(
        `[applyNextAuthUrlToProcessEnv] Loopback URL в настройках — NEXTAUTH_URL=${effective}`
      );
    }
  }

  Reflect.set(process.env, 'NEXTAUTH_URL', effective);
}
