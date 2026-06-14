/**
 * Кэш site_url / portal_title для горячего пути Telegram-бота (без await к БД на каждый /menu).
 */
import { getSystemSettings } from '@/lib/settings';

const TTL_MS = 5 * 60_000;

let cache: { at: number; siteUrl: string; portalTitle: string } | null = null;
let inFlight: Promise<{ siteUrl: string; portalTitle: string }> | null = null;

export async function getBotSiteSettings(): Promise<{ siteUrl: string; portalTitle: string }> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return { siteUrl: cache.siteUrl, portalTitle: cache.portalTitle };
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const s = await getSystemSettings();
      const siteUrl = s.site_url?.replace(/\/$/, '') || '';
      const portalTitle = s.portal_title || 'AVATERRA';
      cache = { at: Date.now(), siteUrl, portalTitle };
      return { siteUrl, portalTitle };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
