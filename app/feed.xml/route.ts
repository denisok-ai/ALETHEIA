import { blogPostsMeta } from '@/lib/content/course-lynda-teaser';
import { getSystemSettings } from '@/lib/settings';
import { normalizeSiteUrl } from '@/lib/site-url';
import { prisma } from '@/lib/db';

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
 * RSS 2.0: статьи блога + новости из БД (обнаружение и агрегаторы).
 */
export async function GET() {
  const settings = await getSystemSettings();
  const base = normalizeSiteUrl(settings.site_url || 'https://avaterra.pro').replace(/\/$/, '');
  const channelLink = `${base}/blog`;

  type FeedItem = { title: string; link: string; date: Date; description: string };
  const blogItems: FeedItem[] = blogPostsMeta.map((p) => ({
    title: p.title,
    link: `${base}/blog/${p.slug}`,
    date: new Date(p.publishedAt),
    description: p.description,
  }));

  let newsItems: FeedItem[] = [];
  try {
    const pubs = await prisma.publication.findMany({
      where: { status: 'active' },
      select: { id: true, title: true, teaser: true, publishAt: true },
      orderBy: { publishAt: 'desc' },
      take: 50,
    });
    newsItems = pubs.map((p) => ({
      title: p.title,
      link: `${base}/news/${p.id}`,
      date: p.publishAt ?? new Date(0),
      description: p.teaser ?? p.title,
    }));
  } catch {
    // БД недоступна — отдаём только блог
  }

  const itemsXml = [...blogItems, ...newsItems]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((p) =>
      [
        '<item>',
        `<title>${escapeXml(p.title)}</title>`,
        `<link>${p.link}</link>`,
        `<guid isPermaLink="true">${p.link}</guid>`,
        `<pubDate>${p.date.toUTCString()}</pubDate>`,
        `<description>${escapeXml(p.description)}</description>`,
        '</item>',
      ].join('')
    )
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
