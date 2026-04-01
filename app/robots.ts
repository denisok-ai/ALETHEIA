import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl, siteUrlHostForRobots } from '@/lib/site-url';

/**
 * Генерирует robots.txt. Разрешена индексация публичных страниц.
 * Базовый URL из БД (Портал → Настройки). Настройки вынесены в админку.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSystemSettings();
  const baseUrl = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal/', '/api/', '/auth/'],
      },
    ],
    host: siteUrlHostForRobots(settings.site_url || 'https://avaterra.pro'),
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
