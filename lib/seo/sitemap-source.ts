/**
 * Чтение данных для карты сайта: настройки, услуги, статьи, публикации из БД
 * и статический словарь. Отбор адресов и дат — в lib/seo/sitemap-entries.ts.
 *
 * Критично: карта НЕ должна отдавать 500. Каждый источник — в своём try/catch:
 * если база недоступна, раздел остаётся без адресов из неё, а индекс и остальные
 * разделы отдаются. Пустой/частичный sitemap лучше, чем падение — иначе
 * Google/Яндекс перестают доверять карте сайта.
 *
 * Динамическая генерация при запросе — актуальные URL после деплоя.
 */
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { getPublishedBlogPosts } from '@/lib/content/blog-posts';
import { getPublicProducts } from '@/lib/shop/public-products';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { KB_REVISED } from '@/lib/content/kb-revisions';
import {
  buildSitemapSections,
  type SitemapItem,
  type SitemapSectionId,
  type SitemapSource,
} from '@/lib/seo/sitemap-entries';

const DEFAULT_BASE = 'https://avaterra.pro';

async function safely<T>(name: string, load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (e) {
    console.error(`[sitemap] ${name} недоступны, раздел без этих адресов:`, e);
    return fallback;
  }
}

/** Базовый адрес из БД (Портал → Настройки). Не задан или сбой — адрес по умолчанию. */
async function resolveBase(): Promise<string> {
  try {
    const settings = await getSystemSettings();
    return normalizeSiteUrl(settings.site_url || DEFAULT_BASE);
  } catch (e) {
    console.error('[sitemap] getSystemSettings failed, using default base:', e);
    return DEFAULT_BASE;
  }
}

/** Адреса всех разделов для индекса и дочерних карт. Одна выборка на запрос. */
export async function loadSitemapSections(): Promise<{
  base: string;
  sections: Record<SitemapSectionId, SitemapItem[]>;
}> {
  const base = await resolveBase();
  const products = await safely('услуги', () => getPublicProducts(), []);
  const blogPosts = await safely('статьи блога', () => getPublishedBlogPosts(), []);
  // Публикации новостей: их страницы /news/<id> в карте есть, сама /news — нет.
  const publications = await safely(
    'публикации новостей',
    () =>
      prisma.publication.findMany({
        where: { status: 'active' },
        select: { id: true, updatedAt: true },
        orderBy: { publishAt: 'desc' },
        take: 500,
      }),
    []
  );

  const source: SitemapSource = {
    base,
    products,
    blogPosts,
    publications,
    glossaryTerms: GLOSSARY_TERMS,
    kbRevised: KB_REVISED,
  };
  return { base, sections: buildSitemapSections(source) };
}
