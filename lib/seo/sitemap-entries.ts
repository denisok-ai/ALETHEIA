/**
 * Карта сайта по разделам: отбор адресов, lastmod и приоритеты.
 *
 * Один источник для индекса `/sitemap.xml` и дочерних карт `/sitemaps/<раздел>.xml`:
 * lastmod раздела в индексе — самая свежая дата среди его адресов, та же, что и в дочерней карте.
 *
 * Модуль чистый: данные передаются аргументом (читает их lib/seo/sitemap-source.ts),
 * поэтому тесты не тянут БД.
 *
 * Разделы: pages (главная, статические страницы, курсы, новости), services (тарифы),
 * blog (статьи), glossary (термины). Страница /news исключена: она пустая.
 */
import type { GlossaryTerm } from '@/lib/content/glossary';

export const SITEMAP_SECTION_IDS = ['pages', 'services', 'blog', 'glossary'] as const;
export type SitemapSectionId = (typeof SITEMAP_SECTION_IDS)[number];

type ChangeFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type SitemapItem = {
  url: string;
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};

/** Входные данные: публичные записи из БД и статика. Даты могут быть строкой, Date или пустыми. */
export type SitemapSource = {
  /** Базовый адрес сайта без слэша на конце */
  base: string;
  products: { slug: string; updatedAt: Date | string | null | undefined }[];
  /** updatedAt — правка статьи в БД (BlogPost.updatedAt); у статей из файла его нет. */
  blogPosts: { slug: string; publishedAt: Date | string | null | undefined; updatedAt?: Date | string | null }[];
  publications: { id: string; updatedAt: Date | string | null | undefined }[];
  glossaryTerms: readonly GlossaryTerm[];
  kbRevised: Readonly<Record<string, string | undefined>>;
};

export const SITEMAP_XML_HEADERS = { 'Content-Type': 'application/xml; charset=utf-8' } as const;

/** Безопасная дата для lastmod: Invalid Date ломает сериализацию (toISOString → RangeError) → HTTP 500. */
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
  '/course/navyki-myshechnogo-testirovaniya': '2026-10-16',
  '/course/probuzhdenie': '2026-08-11',
  '/about': '2026-10-13',
  '/faq': '2026-07-16',
  '/obuchenie-kineziologii-onlajn': '2026-10-18',
  '/contacts': '2026-10-13',
  '/news': '2026-07-19',
  '/oferta': '2026-10-13',
  '/privacy': '2026-10-18',
  '/pd-consent': '2026-10-13',
};

/** Дата правки статической страницы из CONTENT_REVISED (для dateModified в разметке страницы). */
export function contentRevisedDate(path: string): string | undefined {
  return CONTENT_REVISED[path];
}

/**
 * «Этаж» lastmod для страниц тарифов: их дата берётся из Service.updatedAt
 * (последнее редактирование в админке), но при правке ШАБЛОНА разметки
 * (напр. 13.08 добавлен shippingDetails в JsonLdProduct) дата в БД не
 * меняется — и краулеры не переобходят обновление. Обновлять при каждой
 * правке шаблона страниц /services/*.
 */
const PRODUCT_TEMPLATE_REVISED = new Date('2026-10-25');

/**
 * «Этаж» lastmod главной: её дата берётся из самой свежей статьи/услуги, а правка
 * самих секций главной (24.10.2026 — блоки «Словарь» и «Свежее в блоге») туда не
 * попадает. Обновлять при каждой правке содержимого главной.
 */
const HOME_TEMPLATE_REVISED = new Date('2026-10-24');

/** Базовая дата словаря; переписанный термин несёт свою `revised`, индекс — самую свежую. */
const GLOSSARY_REVISED = new Date('2026-09-24');

/** Статические страницы раздела «pages» (главная и новости добавляются отдельно). */
const STATIC_PAGES: { path: string; changeFrequency: ChangeFrequency; priority: number }[] = [
  { path: '/course/navyki-myshechnogo-testirovaniya', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/course/probuzhdenie', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.72 },
  { path: '/obuchenie-kineziologii-onlajn', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/contacts', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/oferta', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/pd-consent', changeFrequency: 'yearly', priority: 0.45 },
];

function item(
  url: string,
  lastModified: Date | undefined,
  changeFrequency: ChangeFrequency,
  priority: number
): SitemapItem {
  return { url, ...(lastModified ? { lastModified } : {}), changeFrequency, priority };
}

/** Адреса по разделам. Одинаковые входные данные дают одинаковый результат. */
export function buildSitemapSections(src: SitemapSource): Record<SitemapSectionId, SitemapItem[]> {
  const { base } = src;
  const abs = (path: string) => `${base}${path || '/'}`;

  const newestPost = newestOf(src.blogPosts.map((p) => safeDate(p.publishedAt)));
  const newestProduct = newestOf([
    ...src.products.map((p) => safeDate(p.updatedAt)),
    PRODUCT_TEMPLATE_REVISED,
  ]);
  // Дата раздела «Блог» и «Услуги» — из самых свежих записей; главная — из обоих.
  const derived: Record<string, Date | undefined> = {
    '/blog': newestPost,
    '/services': newestProduct,
    '': newestOf([newestPost, newestProduct, HOME_TEMPLATE_REVISED]),
  };
  const sectionLastmod = (path: string): Date | undefined =>
    derived[path] ?? (CONTENT_REVISED[path] ? safeDate(CONTENT_REVISED[path]) : undefined);

  const pages: SitemapItem[] = [
    item(abs(''), sectionLastmod(''), 'weekly', 1),
    ...STATIC_PAGES.map(({ path, changeFrequency, priority }) =>
      item(abs(path), sectionLastmod(path), changeFrequency, priority)
    ),
    ...src.publications.map((p) =>
      item(abs(`/news/${p.id}`), safeDate(p.updatedAt), 'weekly', 0.7)
    ),
  ];

  const services: SitemapItem[] = [
    item(abs('/services'), sectionLastmod('/services'), 'weekly', 0.85),
    ...src.products.map((p) =>
      item(abs(`/services/${p.slug}`), newestOf([safeDate(p.updatedAt), PRODUCT_TEMPLATE_REVISED]), 'weekly', 0.8)
    ),
  ];

  const blog: SitemapItem[] = [
    item(abs('/blog'), sectionLastmod('/blog'), 'weekly', 0.75),
    ...src.blogPosts.map((p) =>
      item(
        abs(`/blog/${p.slug}`),
        // Та же дата правки, что в dateModified статьи (lib/content/article-dates.ts):
        // публикация, KB_REVISED и правка в БД — самая свежая.
        newestOf([safeDate(p.publishedAt), safeDate(src.kbRevised[p.slug] ?? null), safeDate(p.updatedAt ?? null)]),
        'monthly',
        0.65
      )
    ),
  ];

  // Глоссарий: статичный контент из кода; lastmod — дата последней правки терминов.
  const termRevised = (t: GlossaryTerm): Date =>
    newestOf([GLOSSARY_REVISED, safeDate(t.revised ?? null)]) ?? GLOSSARY_REVISED;
  const glossary: SitemapItem[] = [
    item(abs('/glossary'), newestOf(src.glossaryTerms.map(termRevised)) ?? GLOSSARY_REVISED, 'monthly', 0.6),
    ...src.glossaryTerms.map((t) => item(abs(`/glossary/${t.slug}`), termRevised(t), 'monthly', 0.5)),
  ];

  return { pages, services, blog, glossary };
}

/** Имя файла дочерней карты → раздел: «blog.xml» → «blog». Прочее — null. */
export function sectionIdFromFileName(file: string): SitemapSectionId | null {
  return SITEMAP_SECTION_IDS.find((id) => `${id}.xml` === file) ?? null;
}

/** Путь дочерней карты: `/sitemaps/blog.xml`. */
export function sitemapSectionPath(id: SitemapSectionId): string {
  return `/sitemaps/${id}.xml`;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function newestItemDate(items: SitemapItem[]): Date | undefined {
  return newestOf(items.map((i) => i.lastModified));
}

/** Дочерняя карта: `<urlset>` со всеми адресами раздела. */
export function renderUrlset(items: SitemapItem[]): string {
  const blocks = items.map((i) =>
    [
      '  <url>',
      `    <loc>${escapeXml(i.url)}</loc>`,
      ...(i.lastModified ? [`    <lastmod>${i.lastModified.toISOString()}</lastmod>`] : []),
      `    <changefreq>${i.changeFrequency}</changefreq>`,
      `    <priority>${i.priority}</priority>`,
      '  </url>',
    ].join('\n')
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...blocks,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Индекс `<sitemapindex>`: по записи на раздел. lastmod раздела — самая свежая
 * дата его адресов (поисковик перекачивает дочернюю карту только при изменении).
 */
export function renderSitemapIndex(base: string, sections: Record<SitemapSectionId, SitemapItem[]>): string {
  const blocks = SITEMAP_SECTION_IDS.map((id) => {
    const lastmod = newestItemDate(sections[id]);
    return [
      '  <sitemap>',
      `    <loc>${escapeXml(`${base}${sitemapSectionPath(id)}`)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod.toISOString()}</lastmod>`] : []),
      '  </sitemap>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...blocks,
    '</sitemapindex>',
    '',
  ].join('\n');
}
