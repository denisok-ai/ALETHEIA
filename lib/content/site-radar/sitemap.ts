/**
 * Парсер sitemap.xml и robots.txt для Site Radar.
 */
export type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
  changefreq?: string | null;
  priority?: number | null;
};

export function parseSitemap(xmlText: string): SitemapEntry[] {
  if (!xmlText?.trim()) return [];
  const entries: SitemapEntry[] = [];
  const urlBlocks = xmlText.match(/<url>[\s\S]*?<\/url>/gi) ?? [];
  for (const block of urlBlocks) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/i)?.[1]?.trim() || null;
    const changefreq = block.match(/<changefreq>([^<]+)<\/changefreq>/i)?.[1]?.trim() || null;
    const priorityRaw = block.match(/<priority>([^<]+)<\/priority>/i)?.[1]?.trim();
    const priority = priorityRaw ? parseFloat(priorityRaw) : null;
    entries.push({ loc, lastmod, changefreq, priority: Number.isFinite(priority!) ? priority : null });
  }
  if (entries.length) return entries;
  const locs = xmlText.match(/<loc>([^<]+)<\/loc>/gi)?.map((m) => m.replace(/<\/?loc>/gi, '').trim()) ?? [];
  return locs.map((loc) => ({ loc }));
}

export type RobotsRules = {
  disallow: string[];
  allow: string[];
  sitemaps: string[];
  crawlDelay?: number | null;
};

export function parseRobots(text: string): RobotsRules {
  const disallow: string[] = [];
  const allow: string[] = [];
  const sitemaps: string[] = [];
  let crawlDelay: number | null = null;
  let currentAgent: string | null = null;
  for (const rawLine of (text ?? '').split('\n')) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line.includes(':')) continue;
    const [keyRaw, ...rest] = line.split(':');
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') currentAgent = value.toLowerCase();
    else if (key === 'sitemap') sitemaps.push(value);
    else if (currentAgent === '*' || currentAgent === 'avaterrasiteradar/1.0' || !currentAgent) {
      if (key === 'disallow' && value) disallow.push(value);
      if (key === 'allow' && value) allow.push(value);
      if (key === 'crawl-delay') crawlDelay = parseFloat(value) || null;
    }
  }
  return { disallow, allow, sitemaps, crawlDelay };
}

export function isPathAllowed(path: string, robots: RobotsRules): boolean {
  let matchLen = -1;
  let decision = true;
  for (const rule of robots.disallow) {
    if (rule && path.startsWith(rule) && rule.length > matchLen) {
      matchLen = rule.length;
      decision = false;
    }
  }
  for (const rule of robots.allow) {
    if (rule && path.startsWith(rule) && rule.length > matchLen) {
      matchLen = rule.length;
      decision = true;
    }
  }
  return decision;
}

export function filterEntriesByRobots(entries: SitemapEntry[], robots: RobotsRules, host: string): SitemapEntry[] {
  const target = host.toLowerCase();
  return entries.filter((e) => {
    try {
      const u = new URL(e.loc);
      if (u.hostname.toLowerCase() !== target) return false;
      return isPathAllowed(u.pathname || '/', robots);
    } catch {
      return false;
    }
  });
}

export function normalizeSitemapHost(entries: SitemapEntry[], targetHost: string): SitemapEntry[] {
  const target = targetHost.toLowerCase();
  return entries.map((e) => {
    try {
      const u = new URL(e.loc);
      if (u.hostname.toLowerCase() === target) return e;
      u.hostname = targetHost;
      u.protocol = 'https:';
      return { ...e, loc: u.toString() };
    } catch {
      return e;
    }
  });
}
