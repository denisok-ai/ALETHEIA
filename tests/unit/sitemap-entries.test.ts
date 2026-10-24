import { describe, it, expect } from 'vitest';
import { GLOSSARY_TERMS } from '@/lib/content/glossary';
import { KB_REVISED } from '@/lib/content/kb-revisions';
import {
  buildSitemapSections,
  escapeXml,
  renderSitemapIndex,
  renderUrlset,
  sectionIdFromFileName,
  type SitemapItem,
  type SitemapSource,
} from '@/lib/seo/sitemap-entries';

const BASE = 'https://avaterra.pro';

function fixture(over: Partial<SitemapSource> = {}): SitemapSource {
  return {
    base: BASE,
    products: [
      { slug: 'navyki-prakt', updatedAt: new Date('2026-10-01T10:00:00Z') },
      { slug: 'probuzhdenie-pro', updatedAt: new Date('2026-08-01T10:00:00Z') },
    ],
    blogPosts: [
      { slug: 'obychnaya-statya', publishedAt: '2026-07-01T10:00:00Z' },
      // Есть в KB_REVISED: lastmod — дата ревизии, она свежее публикации
      { slug: 'karta-emotsiy', publishedAt: '2026-07-02T10:00:00Z' },
      { slug: 'novaya-statya', publishedAt: '2026-10-20T08:00:00Z' },
    ],
    publications: [{ id: 'pub-1', updatedAt: new Date('2026-10-10T09:00:00Z') }],
    glossaryTerms: GLOSSARY_TERMS,
    kbRevised: KB_REVISED,
    ...over,
  };
}

const urlsOf = (items: SitemapItem[]) => items.map((i) => i.url);
const find = (items: SitemapItem[], url: string) => items.find((i) => i.url === url);

describe('карта сайта: отбор адресов по разделам', () => {
  it('делит адреса на четыре раздела', () => {
    const s = buildSitemapSections(fixture());
    expect(Object.keys(s)).toEqual(['pages', 'services', 'blog', 'glossary']);
  });

  it('/news не попадает в карту, страницы новостей остаются в pages', () => {
    const s = buildSitemapSections(fixture());
    const all = [...s.pages, ...s.services, ...s.blog, ...s.glossary];
    expect(urlsOf(all)).not.toContain(`${BASE}/news`);
    expect(urlsOf(s.pages)).toContain(`${BASE}/news/pub-1`);
  });

  it('каждый адрес лежит в своём разделе', () => {
    const s = buildSitemapSections(fixture());
    expect(urlsOf(s.pages)).toContain(`${BASE}/`);
    expect(urlsOf(s.pages)).toContain(`${BASE}/course/navyki-myshechnogo-testirovaniya`);
    expect(urlsOf(s.pages)).toContain(`${BASE}/course/probuzhdenie`);
    expect(urlsOf(s.pages)).not.toContain(`${BASE}/services`);
    expect(urlsOf(s.pages)).not.toContain(`${BASE}/blog`);
    expect(urlsOf(s.services)).toEqual([`${BASE}/services`, `${BASE}/services/navyki-prakt`, `${BASE}/services/probuzhdenie-pro`]);
    expect(urlsOf(s.blog)).toEqual([
      `${BASE}/blog`,
      `${BASE}/blog/obychnaya-statya`,
      `${BASE}/blog/karta-emotsiy`,
      `${BASE}/blog/novaya-statya`,
    ]);
    expect(urlsOf(s.glossary)[0]).toBe(`${BASE}/glossary`);
    expect(s.glossary).toHaveLength(GLOSSARY_TERMS.length + 1);
  });

  it('все прежние адреса на месте, кроме /news', () => {
    const s = buildSitemapSections(fixture());
    const all = new Set(urlsOf([...s.pages, ...s.services, ...s.blog, ...s.glossary]));
    const prior = [
      '/',
      '/course/navyki-myshechnogo-testirovaniya',
      '/course/probuzhdenie',
      '/services',
      '/about',
      '/blog',
      '/faq',
      '/obuchenie-kineziologii-onlajn',
      '/contacts',
      '/oferta',
      '/privacy',
      '/pd-consent',
    ];
    for (const path of prior) expect(all.has(`${BASE}${path}`), path).toBe(true);
  });

  it('адреса не повторяются', () => {
    const s = buildSitemapSections(fixture());
    const all = urlsOf([...s.pages, ...s.services, ...s.blog, ...s.glossary]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('число адресов по разделам: страницы, услуги, статьи, словарь', () => {
    const s = buildSitemapSections(fixture());
    // главная + 9 статических + 1 новость; /services + 2 услуги; /blog + 3 статьи; /glossary + термины
    expect(s.pages).toHaveLength(11);
    expect(s.services).toHaveLength(3);
    expect(s.blog).toHaveLength(4);
    expect(s.glossary).toHaveLength(GLOSSARY_TERMS.length + 1);
  });

  it('статья: lastmod — свежее из публикации и даты ревизии', () => {
    const s = buildSitemapSections(fixture());
    expect(find(s.blog, `${BASE}/blog/obychnaya-statya`)?.lastModified?.toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(find(s.blog, `${BASE}/blog/karta-emotsiy`)?.lastModified?.toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });

  it('раздел блога и главная берут самую свежую дату из своих записей', () => {
    const s = buildSitemapSections(fixture());
    expect(find(s.blog, `${BASE}/blog`)?.lastModified?.toISOString()).toBe('2026-10-20T08:00:00.000Z');
    // У главной есть «этаж» HOME_TEMPLATE_REVISED (правка секций 24.10): статьи старше — берётся он.
    expect(find(s.pages, `${BASE}/`)?.lastModified?.toISOString()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('главная берёт статью, если она свежее «этажа» шаблона', () => {
    const s = buildSitemapSections(fixture({ blogPosts: [{ slug: 'fresh', publishedAt: '2026-11-02T09:00:00.000Z' }] }));
    expect(find(s.pages, `${BASE}/`)?.lastModified?.toISOString()).toBe('2026-11-02T09:00:00.000Z');
  });

  it('без статей /blog выходит без lastmod и не падает', () => {
    const s = buildSitemapSections(fixture({ blogPosts: [] }));
    expect(find(s.blog, `${BASE}/blog`)).toBeDefined();
    expect(find(s.blog, `${BASE}/blog`)?.lastModified).toBeUndefined();
  });

  it('неверная дата публикации не ломает карту (нет Invalid Date)', () => {
    const s = buildSitemapSections(fixture({ blogPosts: [{ slug: 'x', publishedAt: 'не дата' }] }));
    const item = find(s.blog, `${BASE}/blog/x`);
    expect(item).toBeDefined();
    expect(item?.lastModified).toBeUndefined();
  });
});

describe('карта сайта: XML', () => {
  it('индекс: четыре дочерние карты с адресами и lastmod = самая свежая дата раздела', () => {
    const sections = buildSitemapSections(fixture());
    const xml = renderSitemapIndex(BASE, sections);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    const blocks = [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)].map((m) => m[1]);
    expect(blocks).toHaveLength(4);
    for (const id of ['pages', 'services', 'blog', 'glossary']) {
      expect(xml).toContain(`<loc>${BASE}/sitemaps/${id}.xml</loc>`);
    }
    const blogBlock = blocks.find((b) => b.includes('/sitemaps/blog.xml'))!;
    expect(blogBlock).toContain('<lastmod>2026-10-20T08:00:00.000Z</lastmod>');
  });

  it('дочерняя карта: <urlset> с тем же числом <url>, что и в разделе', () => {
    const sections = buildSitemapSections(fixture());
    const xml = renderUrlset(sections.blog);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect([...xml.matchAll(/<url>/g)]).toHaveLength(sections.blog.length);
    expect(xml).toContain(`<loc>${BASE}/blog/novaya-statya</loc>`);
    expect(xml).toContain('<lastmod>2026-10-20T08:00:00.000Z</lastmod>');
  });

  it('спецсимволы в адресе экранируются', () => {
    expect(escapeXml('a&b<c>"d\'')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
  });

  it('имя файла дочерней карты → раздел', () => {
    expect(sectionIdFromFileName('blog.xml')).toBe('blog');
    expect(sectionIdFromFileName('glossary.xml')).toBe('glossary');
    expect(sectionIdFromFileName('news.xml')).toBeNull();
    expect(sectionIdFromFileName('blog')).toBeNull();
  });
});
