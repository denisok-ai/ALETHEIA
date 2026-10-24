/**
 * Чтение карты сайта с учётом индекса `<sitemapindex>`.
 *
 * `/sitemap.xml` — индекс, адреса страниц лежат в дочерних картах `/sitemaps/<раздел>.xml`.
 * Потребители, которые разбирают карту (автопереобход, IndexNow, Site Radar, проверки прода),
 * должны брать URL из дочерних карт, а не из `<loc>` индекса.
 *
 * Модуль без зависимостей от Next и БД: годится и для скриптов (tsx), и для серверного кода.
 */

/** Загрузка текста карты по адресу. Бросает исключение, если карта недоступна. */
export type SitemapFetcher = (url: string) => Promise<string>;

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/** Все `<loc>` документа: адреса страниц для `<urlset>`, адреса дочерних карт для индекса. */
export function extractSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * Тексты всех `<urlset>` по тексту корневой карты: сама карта, либо её дочерние карты,
 * если корень — индекс. Индекс у нас плоский, глубже не спускаемся.
 *
 * Ошибка загрузки дочерней карты пробрасывается, а не глотается: неполный набор URL
 * хуже, чем сбой прогона. Иначе Site Radar сочтёт пропавшие страницы удалёнными.
 */
export async function expandSitemapXml(rootXml: string, fetchText: SitemapFetcher): Promise<string[]> {
  if (!isSitemapIndex(rootXml)) return [rootXml];
  return Promise.all(extractSitemapLocs(rootXml).map((url) => fetchText(url)));
}

/** Все адреса страниц карты по её адресу: индекс раскрывается в дочерние карты. */
export async function readSitemapUrls(rootUrl: string, fetchText: SitemapFetcher): Promise<string[]> {
  const xmls = await expandSitemapXml(await fetchText(rootUrl), fetchText);
  return xmls.flatMap((xml) => extractSitemapLocs(xml));
}

/** Загрузка карты по HTTP с таймаутом; ответ не 2xx — ошибка. */
export async function fetchSitemapText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}: ${url}`);
  return res.text();
}
