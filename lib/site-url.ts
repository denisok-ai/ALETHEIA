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

/**
 * NextAuth читает NEXTAUTH_URL из process.env на запросах; подставляем из БД (URL сайта в настройках).
 * Приоритет: явный nextauth_url из overrides → site_url → NEXT_PUBLIC_URL.
 */
export function applyNextAuthUrlToProcessEnv(params: {
  explicitNextAuthUrl?: string | null;
  siteUrl?: string | null;
}): void {
  const explicit = params.explicitNextAuthUrl?.trim();
  const site = params.siteUrl?.trim();
  const pub = process.env.NEXT_PUBLIC_URL?.trim() || '';
  const raw = explicit || site || pub;
  if (!raw) return;
  process.env.NEXTAUTH_URL = normalizeSiteUrl(raw);
}
