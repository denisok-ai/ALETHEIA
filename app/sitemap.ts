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
 *
 * Критично: функция НЕ должна отдавать 500. Пустой/частичный sitemap лучше, чем падение —
 * иначе Google/Яндекс перестают доверять карте сайта.
 */
export const dynamic = 'force-dynamic';

/** Безопасная дата для lastmod: Invalid Date ломает сериализацию Next → HTTP 500. */
function safeDate(value: unknown): Date | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value as string | number);
  const t = d.getTime();
  return Number.isFinite(t) ? d : undefined;
}

function newestOf(dates: (Date | null | undefined)[]): Date | undefined {
  const ms = dates
    .map((d) => (d ? d.getTime() : NaN))
    .filter((t) => Number.isFinite(t));
  return ms.length ? new Date(Math.max(...ms)) : undefined;
}

function staticFallback(base: string): MetadataRoute.Sitemap {
  const paths = [
    '',
    '/course/navyki-myshechnogo-testirovaniya',
    '/course/probuzhdenie',
    '/services',
    '/about',
    '/blog',
    '/faq',
    '/contacts',
    '/news',
    '/oferta',
    '/privacy',
    '/pd-consent',
  ];
  return paths.map((path, i) => ({
    url: `${base}${path || '/'}`,
    changeFrequency: i === 0 ? ('weekly' as const) : ('monthly' as const),
    priority: i === 0 ? 1 : 0.7,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let base = 'https://avaterra.pro';
  try {
    const settings = await getSystemSettings();
    base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro');
  } catch (e) {
    console.error('[sitemap] getSystemSettings failed, using default base:', e);
  }

  try {
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
      '/course/navyki-myshechnogo-testirovaniya': '2026-06-08',
      '/course/probuzhdenie': '2026-08-11',
      '/about': '2026-07-22',
      '/faq': '2026-07-16',
      '/contacts': '2026-06-08',
      '/news': '2026-07-16',
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
      { path: '/news', changeFrequency: 'weekly' as const, priority: 0.7 },
      { path: '/oferta', changeFrequency: 'monthly' as const, priority: 0.9 },
      { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.5 },
      { path: '/pd-consent', changeFrequency: 'yearly' as const, priority: 0.45 },
    ];

    const products = await getPublicProducts();
    const blogPosts = await getPublishedBlogPosts();

    const newestPost = newestOf(blogPosts.map((p) => safeDate(p.publishedAt)));
    const newestProduct = newestOf(products.map((p) => safeDate(p.updatedAt)));
    const derived: Record<string, Date | undefined> = {
      '/blog': newestPost,
      '/services': newestProduct,
      '': newestOf([newestPost, newestProduct]),
    };

    const staticEntries: MetadataRoute.Sitemap = [
      ...publicPaths.map(({ path, changeFrequency, priority }) => {
        const revised = CONTENT_REVISED[path];
        const lastModified = derived[path] ?? (revised ? safeDate(revised) : undefined);
        return {
          url: `${base}${path || '/'}`,
          ...(lastModified ? { lastModified } : {}),
          changeFrequency,
          priority,
        };
      }),
      ...blogPosts.map((p) => {
        const lastModified = safeDate(p.publishedAt);
        return {
          url: `${base}/blog/${p.slug}`,
          ...(lastModified ? { lastModified } : {}),
          changeFrequency: 'monthly' as const,
          priority: 0.65,
        };
      }),
    ];

    const serviceEntries: MetadataRoute.Sitemap = products.map((p) => {
      const lastModified = safeDate(p.updatedAt);
      return {
        url: `${base}/services/${p.slug}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      };
    });

    let newsEntries: MetadataRoute.Sitemap = [];
    let newestNews: Date | undefined;
    try {
      const pubs = await prisma.publication.findMany({
        where: { status: 'active' },
        select: { id: true, updatedAt: true },
        orderBy: { publishAt: 'desc' },
        take: 500,
      });
      newestNews = newestOf(pubs.map((p) => safeDate(p.updatedAt)));
      newsEntries = pubs.map((p) => {
        const lastModified = safeDate(p.updatedAt);
        return {
          url: `${base}/news/${p.id}`,
          ...(lastModified ? { lastModified } : {}),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        };
      });
    } catch {
      // БД недоступна — отдаём статические URL без новостей
    }

    // Обновляем lastmod индекса /news из самой свежей публикации
    if (newestNews) {
      const newsIdx = staticEntries.findIndex((e) => e.url === `${base}/news`);
      if (newsIdx >= 0) {
        staticEntries[newsIdx] = { ...staticEntries[newsIdx], lastModified: newestNews };
      }
    }

    return [...staticEntries, ...serviceEntries, ...newsEntries];
  } catch (e) {
    console.error('[sitemap] generation failed, returning static fallback:', e);
    return staticFallback(base);
  }
}
