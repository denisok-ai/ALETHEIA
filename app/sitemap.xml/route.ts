/**
 * Индекс карты сайта: /sitemap.xml ссылается на дочерние карты разделов
 * (/sitemaps/<раздел>.xml, см. app/sitemaps/[file]/route.ts). Адреса и даты — lib/seo/sitemap-entries.ts.
 *
 * Route handler, а не app/sitemap.ts: файл-соглашение Next отдаёт один <urlset>,
 * а индекс нужен отдельным XML. Robots.txt по-прежнему указывает на этот адрес.
 */
import { renderSitemapIndex, SITEMAP_XML_HEADERS } from '@/lib/seo/sitemap-entries';
import { loadSitemapSections } from '@/lib/seo/sitemap-source';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { base, sections } = await loadSitemapSections();
  return new Response(renderSitemapIndex(base, sections), { headers: SITEMAP_XML_HEADERS });
}
