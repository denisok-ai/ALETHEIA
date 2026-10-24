import { describe, it, expect, vi } from 'vitest';
import {
  expandSitemapXml,
  extractSitemapLocs,
  isSitemapIndex,
  readSitemapUrls,
} from '@/lib/seo/sitemap-read';

const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
const urlset = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset ${NS}>${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;
const indexXml = (locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><sitemapindex ${NS}>${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join('')}</sitemapindex>`;

const BASE = 'https://avaterra.pro';
const ROOT = `${BASE}/sitemap.xml`;
const PAGES = `${BASE}/sitemaps/pages.xml`;
const BLOG = `${BASE}/sitemaps/blog.xml`;

/** Фиктивная сеть: карты по адресам; отсутствующий адрес — ошибка, как при HTTP 404. */
function network(files: Record<string, string>) {
  return vi.fn(async (url: string) => {
    if (!(url in files)) throw new Error(`sitemap HTTP 404: ${url}`);
    return files[url];
  });
}

const files = {
  [PAGES]: urlset([`${BASE}/`, `${BASE}/about`]),
  [BLOG]: urlset([`${BASE}/blog`, `${BASE}/blog/a`]),
  [ROOT]: indexXml([PAGES, BLOG]),
};

describe('чтение карты с учётом индекса', () => {
  it('различает индекс и обычную карту', () => {
    expect(isSitemapIndex(files[ROOT])).toBe(true);
    expect(isSitemapIndex(files[PAGES])).toBe(false);
  });

  it('extractSitemapLocs берёт все <loc> и обрезает пробелы', () => {
    expect(extractSitemapLocs('<urlset><url><loc> https://a.ru/x </loc></url></urlset>')).toEqual(['https://a.ru/x']);
  });

  it('адреса страниц из индекса — из дочерних карт, а не сами файлы карт', async () => {
    const fetchText = network(files);
    const urls = await readSitemapUrls(ROOT, fetchText);
    expect(urls).toEqual([`${BASE}/`, `${BASE}/about`, `${BASE}/blog`, `${BASE}/blog/a`]);
    expect(urls.some((u) => u.includes('/sitemaps/'))).toBe(false);
    expect(fetchText).toHaveBeenCalledTimes(3);
  });

  it('обычная карта читается как есть, без дополнительных запросов', async () => {
    const fetchText = network(files);
    const urls = await readSitemapUrls(PAGES, fetchText);
    expect(urls).toEqual([`${BASE}/`, `${BASE}/about`]);
    expect(fetchText).toHaveBeenCalledTimes(1);
  });

  it('expandSitemapXml для обычной карты возвращает её саму', async () => {
    const fetchText = network(files);
    expect(await expandSitemapXml(files[PAGES], fetchText)).toEqual([files[PAGES]]);
    expect(fetchText).not.toHaveBeenCalled();
  });

  it('если дочерняя карта недоступна — ошибка, а не неполный набор адресов', async () => {
    const partial = network({ [ROOT]: files[ROOT], [PAGES]: files[PAGES] });
    await expect(readSitemapUrls(ROOT, partial)).rejects.toThrow('404');
  });
});
