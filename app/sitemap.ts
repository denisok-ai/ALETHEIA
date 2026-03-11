import type { MetadataRoute } from 'next';

/**
 * Генерирует sitemap.xml для поисковых систем.
 * Базовый URL из NEXT_PUBLIC_URL или avaterra.pro.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro';
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
