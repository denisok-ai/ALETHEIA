import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { normalizeSiteUrl } from '@/lib/site-url';
import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';

/**
 * Генерирует sitemap.xml для поисковых систем.
 * Базовый URL из БД (Портал → Настройки). Публикации подтягиваются из БД при доступности.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  const publicPaths = [
    { path: '', changeFrequency: 'weekly' as const, priority: 1 },
    { path: '/course/navyki-myshechnogo-testirovaniya', changeFrequency: 'weekly' as const, priority: 0.85 },
    { path: '/blog', changeFrequency: 'weekly' as const, priority: 0.75 },
    { path: '/oferta', changeFrequency: 'monthly' as const, priority: 0.9 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.5 },
    { path: '/login', changeFrequency: 'yearly' as const, priority: 0.4 },
    { path: '/register', changeFrequency: 'yearly' as const, priority: 0.4 },
    { path: '/reset-password', changeFrequency: 'yearly' as const, priority: 0.3 },
  ];

  const staticEntries: MetadataRoute.Sitemap = [
    ...publicPaths.map(({ path, changeFrequency, priority }) => ({
      url: `${base}${path || '/'}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
    })),
    ...blogPostsMeta.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    })),
  ];

  let newsEntries: MetadataRoute.Sitemap = [];
  try {
    const pubs = await prisma.publication.findMany({
      where: { status: 'active' },
      select: { id: true, updatedAt: true },
      orderBy: { publishAt: 'desc' },
      take: 500,
    });
    newsEntries = pubs.map((p) => ({
      url: `${base}/news/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // БД недоступна при сборке / ошибка — отдаём только статические URL
  }

  return [...staticEntries, ...newsEntries];
}
