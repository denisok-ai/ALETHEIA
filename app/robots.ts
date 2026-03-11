import type { MetadataRoute } from 'next';

/**
 * Генерирует robots.txt. Разрешена индексация публичных страниц.
 * /portal/* защищён middleware и не индексируется по смыслу (требует авторизации).
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro';
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
