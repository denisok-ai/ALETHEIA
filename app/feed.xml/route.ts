import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * RSS 2.0 для статей блога (обнаружение и агрегаторы).
 */
export async function GET() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const channelLink = `${base}/blog`;

  const itemsXml = blogPostsMeta
    .map((p) => {
      const link = `${base}/blog/${p.slug}`;
      const pubDate = new Date(p.publishedAt).toUTCString();
      return [
        '<item>',
        `<title>${escapeXml(p.title)}</title>`,
        `<link>${link}</link>`,
        `<guid isPermaLink="true">${link}</guid>`,
        `<pubDate>${pubDate}</pubDate>`,
        `<description>${escapeXml(p.description)}</description>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${escapeXml('АВАТЕРРА — блог')}</title>
<link>${channelLink}</link>
<description>${escapeXml('Статьи о мышечном тестировании, теле и подсознании — школа АВАТЕРРА.')}</description>
<language>ru-ru</language>
${itemsXml}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
