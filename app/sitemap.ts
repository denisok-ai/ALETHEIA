import type { MetadataRoute } from 'next';
import { getSystemSettings } from '@/lib/settings';
import { prisma } from '@/lib/db';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { getPublicProducts } from '@/lib/shop/public-products';

/**
 * Генерирует sitemap.xml для поисковых систем.
 * Базовый URL из БД (Портал → Настройки). Публикации подтягиваются из БД при доступности.
 * Динамическая генерация при запросе — актуальные URL после деплоя.
 *
 * В карту не попадают служебные публичные страницы (login/register/reset и т.д.) — для них в metadata задано noindex.
 */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  /**
   * Дата последней правки содержимого страницы.
   *
   * Раньше у статических страниц `lastmod` отсутствовал вовсе — из 22 адресов
   * дата была лишь у 11, а поисковики именно по ней решают, что перекрадывать.
   * Без неё ключевые точки входа (главная, лендинги курсов) переобходятся по
   * остаточному принципу.
   *
   * Ставить сюда время сборки НЕЛЬЗЯ: это сообщало бы «изменилось всё» при
   * каждом деплое, и поисковик перестал бы доверять полю. Даты ниже взяты из
   * истории правок соответствующих файлов содержимого.
   *
   * ПРИ РЕДАКТИРОВАНИИ текста страницы обновите здесь дату — иначе поисковик
   * не узнает об изменении.
   */
  const CONTENT_REVISED: Record<string, string> = {
    '/course/navyki-myshechnogo-testirovaniya': '2026-06-08', // lib/content/course-mt-landing.ts
    '/course/probuzhdenie': '2026-06-08', // lib/content/course-probuzhdenie.ts
    '/about': '2026-06-08',
    '/faq': '2026-07-16',
    '/contacts': '2026-06-08',
    '/oferta': '2026-04-27',
    '/privacy': '2026-06-08',
    '/pd-consent': '2026-06-08',
  };

  const publicPaths = [
    { path: '', changeFrequency: 'weekly' as const, priority: 1 },
    { path: '/course/navyki-myshechnogo-testirovaniya', changeFrequency: 'weekly' as const, priority: 0.85 },
    { path: '/course/probuzhdenie', changeFrequency: 'weekly' as const, priority: 0.85 },
    { path: '/services', changeFrequency: 'weekly' as const, priority: 0.85 },
    { path: '/about', changeFrequency: 'monthly' as const, priority: 0.8 },
    { path: '/blog', changeFrequency: 'weekly' as const, priority: 0.75 },
    { path: '/faq', changeFrequency: 'monthly' as const, priority: 0.72 },
    { path: '/contacts', changeFrequency: 'monthly' as const, priority: 0.7 },
    { path: '/oferta', changeFrequency: 'monthly' as const, priority: 0.9 },
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.5 },
    { path: '/pd-consent', changeFrequency: 'yearly' as const, priority: 0.45 },
  ];

  const products = await getPublicProducts();
  const blogPosts = await getPublishedBlogPosts();

  const newestOf = (dates: (Date | null | undefined)[]): Date | undefined => {
    const ms = dates.filter(Boolean).map((d) => (d as Date).getTime());
    return ms.length ? new Date(Math.max(...ms)) : undefined;
  };

  // У списков дата вычисляется из самого свежего материала внутри — вручную её
  // задавать бессмысленно: она устареет при первой же публикации.
  const newestPost = newestOf(blogPosts.map((p) => new Date(p.publishedAt)));
  const newestProduct = newestOf(products.map((p) => p.updatedAt));
  const derived: Record<string, Date | undefined> = {
    '/blog': newestPost,
    '/services': newestProduct,
    // Главная показывает тарифы и ведёт на статьи — свежее из двух источников.
    '': newestOf([newestPost, newestProduct]),
  };

  const staticEntries: MetadataRoute.Sitemap = [
    ...publicPaths.map(({ path, changeFrequency, priority }) => {
      const revised = CONTENT_REVISED[path];
      const lastModified = derived[path] ?? (revised ? new Date(revised) : undefined);
      return {
        url: `${base}${path || '/'}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency,
        priority,
      };
    }),
    ...blogPosts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    })),
  ];

  // Тарифы/услуги из БД — страницы товаров /services/[slug]
  const serviceEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/services/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

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

  return [...staticEntries, ...serviceEntries, ...newsEntries];
}
