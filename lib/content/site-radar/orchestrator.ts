/**
 * Оркестратор Site Radar: sitemap → crawl → diff → signals → theme_pool.
 */
import { prisma } from '@/lib/db';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import { getContentConfig } from '../config';
import { categorizeUrl } from './categorizer';
import { diffVersions } from './diff';
import { normalizeHtml, pageContentHash, type ContentBlock } from './normalizer';
import { scoreNewUrl, scorePageDiff, scoreRemovedUrl, type ScoredSignal } from './scorer';
import {
  filterEntriesByRobots,
  normalizeSitemapHost,
  parseRobots,
  parseSitemap,
  type SitemapEntry,
} from './sitemap';
import { buildTheme, isDuplicateTopic } from './strategist';

export type RadarCycleStats = {
  pagesSeen: number;
  pagesChanged: number;
  signalsTotal: number;
  signalsHigh: number;
  themesAdded: number;
  newUrls: number;
  removedUrls: number;
};

const PRIORITY_PATHS = ['/', '/course', '/faq', '/blog'];

async function fetchText(url: string, timeoutMs = 15000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AvaterraSiteRadar/1.0 (+https://avaterra.pro)' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseBlocks(json: string | null): ContentBlock[] | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ContentBlock[];
  } catch {
    return null;
  }
}

async function notifyHighSignals(signals: ScoredSignal[]): Promise<void> {
  const high = signals.filter((s) => s.severity === 'high').slice(0, 5);
  if (!high.length) return;
  const lines = high.map((s) => `· [${s.severity}] ${s.score} — ${s.summary.slice(0, 120)}`);
  await notifyAdminsTelegram('contact_lead', ['Site Radar — значимые изменения:', ...lines]);
}

export async function runSiteRadarCycle(priorityOnly = false): Promise<RadarCycleStats> {
  const config = await getContentConfig();
  const base = config.siteUrl.replace(/\/$/, '');
  const host = new URL(base).hostname;
  const stats: RadarCycleStats = {
    pagesSeen: 0,
    pagesChanged: 0,
    signalsTotal: 0,
    signalsHigh: 0,
    themesAdded: 0,
    newUrls: 0,
    removedUrls: 0,
  };
  const allSignals: ScoredSignal[] = [];

  const robotsText = (await fetchText(`${base}/robots.txt`)) ?? '';
  const robots = parseRobots(robotsText);
  let sitemapUrl = robots.sitemaps[0] ?? `${base}/sitemap.xml`;
  let sitemapXml = (await fetchText(sitemapUrl)) ?? '';
  if (!sitemapXml && sitemapUrl !== `${base}/sitemap.xml`) {
    sitemapUrl = `${base}/sitemap.xml`;
    sitemapXml = (await fetchText(sitemapUrl)) ?? '';
  }

  let entries = normalizeSitemapHost(parseSitemap(sitemapXml), host);
  entries = filterEntriesByRobots(entries, robots, host);

  const activeUrls = new Set(entries.map((e) => e.loc));
  const dbPages = await prisma.sitePage.findMany({ where: { isActive: true } });

  for (const page of dbPages) {
    if (!activeUrls.has(page.url)) {
      await prisma.sitePage.update({ where: { id: page.id }, data: { isActive: false } });
      const sig = scoreRemovedUrl(page.url, page.category);
      await prisma.siteSignal.create({
        data: {
          pageId: page.id,
          signalType: sig.signalType,
          changeType: sig.changeType,
          score: sig.score,
          severity: sig.severity,
          summary: sig.summary,
          payload: JSON.stringify(sig.payload),
        },
      });
      stats.removedUrls += 1;
      stats.signalsTotal += 1;
      allSignals.push(sig);
    }
  }

  let scanEntries: SitemapEntry[] = entries;
  if (priorityOnly) {
    scanEntries = entries.filter((e) => {
      try {
        const p = new URL(e.loc).pathname.replace(/\/$/, '') || '/';
        return PRIORITY_PATHS.some((pp) => p === pp || p.startsWith(pp + '/'));
      } catch {
        return false;
      }
    });
  }

  const knownUrls = new Set(dbPages.map((p) => p.url));

  for (const entry of scanEntries) {
    stats.pagesSeen += 1;
    const category = categorizeUrl(entry.loc);
    const page = await prisma.sitePage.upsert({
      where: { url: entry.loc },
      create: { url: entry.loc, category, lastSeenAt: new Date() },
      update: { category, isActive: true, lastSeenAt: new Date() },
    });

    if (!knownUrls.has(entry.loc)) {
      stats.newUrls += 1;
      const sig = scoreNewUrl(entry.loc, category);
      await prisma.siteSignal.create({
        data: {
          pageId: page.id,
          signalType: sig.signalType,
          changeType: sig.changeType,
          score: sig.score,
          severity: sig.severity,
          summary: sig.summary,
          payload: JSON.stringify(sig.payload),
        },
      });
      stats.signalsTotal += 1;
      if (sig.severity === 'high') stats.signalsHigh += 1;
      allSignals.push(sig);
      await maybeAddTheme(sig, category);
      knownUrls.add(entry.loc);
      continue;
    }

    const html = await fetchText(entry.loc);
    if (!html) continue;
    const blocks = normalizeHtml(html, entry.loc);
    const hash = pageContentHash(blocks);
    const lastVersion = await prisma.sitePageVersion.findFirst({
      where: { pageId: page.id },
      orderBy: { fetchedAt: 'desc' },
    });
    if (lastVersion?.contentHash === hash) continue;

    const oldBlocks = parseBlocks(lastVersion?.normalizedJson ?? null);
    const diff = diffVersions(oldBlocks, blocks);
    if (!diff.hasChanges) {
      await prisma.sitePageVersion.create({
        data: { pageId: page.id, contentHash: hash, normalizedJson: JSON.stringify(blocks) },
      });
      continue;
    }

    stats.pagesChanged += 1;
    const signals = scorePageDiff(diff, category);
    for (const sig of signals) {
      await prisma.siteSignal.create({
        data: {
          pageId: page.id,
          signalType: sig.signalType,
          changeType: sig.changeType,
          score: sig.score,
          severity: sig.severity,
          summary: sig.summary,
          payload: JSON.stringify(sig.payload),
        },
      });
      stats.signalsTotal += 1;
      if (sig.severity === 'high') stats.signalsHigh += 1;
      allSignals.push(sig);
      await maybeAddTheme(sig, category);
    }

    await prisma.sitePageVersion.create({
      data: { pageId: page.id, contentHash: hash, normalizedJson: JSON.stringify(blocks) },
    });
  }

  await notifyHighSignals(allSignals);
  console.log('[site-radar] cycle done', stats);
  return stats;

  async function maybeAddTheme(sig: ScoredSignal, category: string) {
    if (sig.score < 30) return;
    const theme = buildTheme(sig, category);
    const recent = await prisma.themePool.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { topic: true },
    });
    if (isDuplicateTopic(theme.topic, recent.map((r) => r.topic))) return;
    await prisma.themePool.create({
      data: {
        topic: theme.topic,
        postType: theme.postType,
        audience: theme.audience,
        rubric: theme.rubric,
        priority: theme.priority,
        status: 'pending',
        source: 'radar',
        payload: JSON.stringify({ ...theme.payload, angle: theme.angle }),
      },
    });
    stats.themesAdded += 1;
  }
}

export async function formatRecentSignals(limit = 10): Promise<string> {
  const rows = await prisma.siteSignal.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { page: { select: { url: true } } },
  });
  if (!rows.length) return 'Сигналов Site Radar пока нет.';
  return rows
    .map(
      (r, i) =>
        `${i + 1}. [${r.severity}/${r.score}] ${r.summary.slice(0, 80)}\n   ${r.page?.url ?? '—'} · ${r.createdAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`
    )
    .join('\n\n');
}
