import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';

/**
 * Генерирует sitemap.xml для поисковых систем.
 * Базовый URL из БД (Портал → Настройки). Настройки вынесены в админку.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSystemSettings();
  const baseUrl = settings.site_url || 'https://avaterra.pro';
  const publicPaths = [
    '',
    '/oferta',
    '/privacy',
    '/login',
    '/register',
    '/reset-password',
  ];

  return publicPaths.map((path) => ({
    url: `${baseUrl.replace(/\/$/, '')}${path || '/'}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' as const : 'monthly' as const,
    priority: path === '' ? 1 : 0.8,
  }));
}
