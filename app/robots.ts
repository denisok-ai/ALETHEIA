import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';

/**
 * Генерирует robots.txt. Разрешена индексация публичных страниц.
 * Базовый URL из БД (Портал → Настройки). Настройки вынесены в админку.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSystemSettings();
  const baseUrl = settings.site_url || 'https://avaterra.pro';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal/', '/api/', '/auth/'],
      },
    ],
    sitemap: `${baseUrl.replace(/\/$/, '')}/sitemap.xml`,
  };
}
