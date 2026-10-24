/**
 * Дочерние карты разделов: /sitemaps/pages.xml, services.xml, blog.xml, glossary.xml.
 * Адреса в индекс /sitemap.xml попадают из тех же данных (lib/seo/sitemap-entries.ts).
 */
import { renderUrlset, sectionIdFromFileName, SITEMAP_XML_HEADERS } from '@/lib/seo/sitemap-entries';
import { loadSitemapSections } from '@/lib/seo/sitemap-source';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, props: { params: Promise<{ file: string }> }) {
  const { file } = await props.params;
  const id = sectionIdFromFileName(file);
  if (!id) return new Response('Not found', { status: 404 });
  const { sections } = await loadSitemapSections();
  return new Response(renderUrlset(sections[id]), { headers: SITEMAP_XML_HEADERS });
}
