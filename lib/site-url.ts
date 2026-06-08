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

/**
 * NextAuth читает `NEXTAUTH_URL` из `process.env` на запросах.
 *
 * **Приоритет источников:** `nextauth_url` в БД (Портал → Настройки) → `site_url` в БД →
 * `NEXT_PUBLIC_URL` → `NEXTAUTH_URL` в `.env` (только если из БД не задано ни одного URL).
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
  const raw = explicit || site || pub || envFallback;
  if (!raw) return;

  if (process.env.NODE_ENV === 'development') {
    if (explicit) {
      Reflect.set(process.env, 'NEXTAUTH_URL', normalizeSiteUrl(explicit));
      return;
    }
    try {
      const host = new URL(normalizeSiteUrl(raw)).hostname;
      if (!isLoopbackHostname(host)) return;
    } catch {
      return;
    }
  }

  /**
   * В production нельзя применять из БД URL на localhost — иначе ломается getServerSession,
   * админские API отдают 403, а блок «Состояние интеграций» из‑за пустого JSON показывает всё красным.
   */
  let effective = raw;
  if (process.env.NODE_ENV === 'production' && explicit) {
    try {
      const explicitHost = new URL(normalizeSiteUrl(explicit)).hostname;
      if (isLoopbackHostname(explicitHost)) {
        const withoutExplicit = site || pub || envFallback;
        if (withoutExplicit) {
          console.warn(
            '[applyNextAuthUrlToProcessEnv] В production nextauth_url в БД указывает на localhost — игнорируем, используем site_url / NEXT_PUBLIC_URL / NEXTAUTH_URL из .env'
          );
          effective = withoutExplicit;
        }
      }
    } catch {
      const withoutExplicit = site || pub || envFallback;
      if (withoutExplicit) {
        console.warn('[applyNextAuthUrlToProcessEnv] Некорректный nextauth_url в БД — используем запасной URL');
        effective = withoutExplicit;
      }
    }
  }

  Reflect.set(process.env, 'NEXTAUTH_URL', normalizeSiteUrl(effective));
}
