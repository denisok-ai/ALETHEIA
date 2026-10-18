/**
 * Аудит того, что видит Google: Search Console API + URL Inspection + Search Analytics.
 *
 * Только чтение. Единственная запись — `--resubmit-sitemap` (PUT sitemap для sitemap.xml).
 *
 * Запуск (на проде, из /opt/ALETHEIA):
 *   npx tsx scripts/gsc-audit.ts --out /tmp/gsc-audit
 *   npx tsx scripts/gsc-audit.ts --out /tmp/gsc-audit --resubmit-sitemap
 *
 * В --out пишутся data.json (все сырые данные) и summary.md (сводка).
 * Токены и секреты не выводятся: в логах и файлах только статусы и тексты из lib/seo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GSC_SITE_URL, gscCall, submitSitemap } from '../lib/seo/gsc';
import { getGoogleAccessToken, resetGoogleTokenCache } from '../lib/seo/google-oauth';
import type { SeoConnectorStatus } from '../lib/seo/metric-types';

const ROOT_SITEMAP = 'https://avaterra.pro/sitemap.xml';
const INSPECT_API = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const CONCURRENCY = 5;
const LANG = 'ru';
const SA_DAYS = 90;
/** Данные GSC запаздывают на 2–3 дня: конец периода — сегодня минус 3 дня. */
const LAG_DAYS = 3;
const FETCH_TIMEOUT_MS = 30_000;
const INSPECT_ATTEMPTS = 8;

const args = process.argv.slice(2);
const OUT_DIR = path.resolve(argValue('--out', './gsc-audit-out'));
const RESUBMIT = args.includes('--resubmit-sitemap');

function argValue(name: string, fallback: string): string {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function todayMsk(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function xmlDecode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function reasonOf(s: SeoConnectorStatus): string {
  return s.state === 'ok' ? '' : s.reason;
}

function errText(e: unknown): string {
  return e instanceof Error ? e.name + (e.message && /^HTTP \d+$/.test(e.message) ? ` ${e.message}` : '') : 'ошибка';
}

/* ---------- 1. Ресурсы и права ---------- */

type SiteEntry = { siteUrl?: string; permissionLevel?: string };

async function listSites(): Promise<{ error?: string; sites: SiteEntry[] }> {
  const r = await gscCall<{ siteEntry?: SiteEntry[] }>('GET', '/sites');
  if (!r.ok) return { error: reasonOf(r.status), sites: [] };
  return { sites: r.data?.siteEntry ?? [] };
}

/* ---------- 2. Sitemaps в GSC ---------- */

async function listSitemapsRaw(): Promise<{ error?: string; sitemaps: unknown[] }> {
  const r = await gscCall<{ sitemap?: unknown[] }>(
    'GET',
    `/sites/${encodeURIComponent(GSC_SITE_URL)}/sitemaps`
  );
  if (!r.ok) return { error: reasonOf(r.status), sitemaps: [] };
  return { sitemaps: r.data?.sitemap ?? [] };
}

/* ---------- 3. Живой sitemap ---------- */

type SitemapNode = { url: string; kind: 'urlset' | 'index' | 'error'; count: number; error?: string };

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'avaterra-gsc-audit/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** Собирает URL из sitemap; если это индекс — обходит вложенные (до 3 уровней). */
async function collectSitemapUrls(root: string): Promise<{ nodes: SitemapNode[]; urlSources: Map<string, string[]> }> {
  const nodes: SitemapNode[] = [];
  const urlSources = new Map<string, string[]>();
  const seen = new Set<string>();
  const queue: Array<{ url: string; depth: number }> = [{ url: root, depth: 0 }];

  while (queue.length > 0) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);

    let xml: string;
    try {
      xml = await fetchText(url);
    } catch (e) {
      nodes.push({ url, kind: 'error', count: 0, error: errText(e) });
      continue;
    }
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => xmlDecode(m[1].trim()));

    if (/<sitemapindex[\s>]/.test(xml) && depth < 3) {
      nodes.push({ url, kind: 'index', count: locs.length });
      for (const l of locs) queue.push({ url: l, depth: depth + 1 });
    } else {
      nodes.push({ url, kind: 'urlset', count: locs.length });
      for (const l of locs) {
        const from = urlSources.get(l) ?? [];
        from.push(url);
        urlSources.set(l, from);
      }
    }
  }
  return { nodes, urlSources };
}

/* ---------- 4. URL Inspection ---------- */

type Issue = { severity?: string; issueMessage?: string };

type InspectionRow = {
  url: string;
  error?: string;
  verdict?: string;
  coverageState?: string;
  robotsTxtState?: string;
  indexingState?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  lastCrawlTime?: string;
  crawledAs?: string;
  sitemap: string[];
  referringUrls: string[];
  mobileUsability: { verdict?: string; issues: string[] };
  richResults: { verdict?: string; issues: string[] };
  raw?: unknown;
};

/** Общая пауза: при 429 все воркеры ждут, а не долбятся дальше. */
let pauseUntil = 0;

function parseInspection(url: string, body: any): InspectionRow {
  const r = body?.inspectionResult ?? {};
  const idx = r.indexStatusResult ?? {};
  const mob = r.mobileUsabilityResult ?? {};
  const rich = r.richResultsResult ?? {};
  const richIssues: string[] = [];
  for (const item of rich.detectedItems ?? []) {
    for (const it of item.items ?? []) {
      for (const iss of (it.issues ?? []) as Issue[]) {
        richIssues.push(`${iss.severity ?? '?'}: ${iss.issueMessage ?? ''} (${item.richResultType ?? ''})`);
      }
    }
  }
  return {
    url,
    verdict: idx.verdict,
    coverageState: idx.coverageState,
    robotsTxtState: idx.robotsTxtState,
    indexingState: idx.indexingState,
    pageFetchState: idx.pageFetchState,
    googleCanonical: idx.googleCanonical,
    userCanonical: idx.userCanonical,
    lastCrawlTime: idx.lastCrawlTime,
    crawledAs: idx.crawledAs,
    sitemap: idx.sitemap ?? [],
    referringUrls: idx.referringUrls ?? [],
    mobileUsability: {
      verdict: mob.verdict,
      issues: ((mob.issues ?? []) as Issue[]).map((i) => i.issueMessage ?? ''),
    },
    richResults: { verdict: rich.verdict, issues: richIssues },
    raw: r,
  };
}

async function inspectUrl(url: string): Promise<InspectionRow> {
  const empty = (error: string): InspectionRow => ({
    url,
    error,
    sitemap: [],
    referringUrls: [],
    mobileUsability: { issues: [] },
    richResults: { issues: [] },
  });

  for (let attempt = 0; attempt < INSPECT_ATTEMPTS; attempt++) {
    const wait = pauseUntil - Date.now();
    if (wait > 0) await sleep(wait);

    const auth = await getGoogleAccessToken();
    if (!auth.token) return empty(`токен: ${auth.status.state}${'reason' in auth.status ? ` — ${auth.status.reason}` : ''}`);

    let res: Response;
    try {
      res = await fetch(INSPECT_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_SITE_URL, languageCode: LANG }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      if (attempt < INSPECT_ATTEMPTS - 1) {
        await sleep(3000);
        continue;
      }
      return empty(`сеть: ${errText(e)}`);
    }

    if (res.status === 429) {
      // Квота: пауза 20 с, растёт с числом попыток. Общая для всех воркеров.
      pauseUntil = Math.max(pauseUntil, Date.now() + 20_000 * (attempt + 1));
      continue;
    }
    if (res.status === 401) {
      resetGoogleTokenCache();
      continue;
    }
    if (res.status >= 500 && attempt < INSPECT_ATTEMPTS - 1) {
      await sleep(5000);
      continue;
    }
    if (!res.ok) return empty(`HTTP ${res.status}`);
    return parseInspection(url, await res.json());
  }
  return empty('не удалось после повторов (429/401/5xx)');
}

async function runPool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
        if ((i + 1) % 10 === 0 || i + 1 === items.length) console.log(`inspection: ${i + 1}/${items.length}`);
      }
    })
  );
  return out;
}

/* ---------- 5. Search Analytics ---------- */

type SaRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

async function searchAnalytics(
  startDate: string,
  endDate: string,
  dimensions: string[],
  rowLimit: number
): Promise<{ error?: string; rows: SaRow[] }> {
  const r = await gscCall<{ rows?: SaRow[] }>(
    'POST',
    `/sites/${encodeURIComponent(GSC_SITE_URL)}/searchAnalytics/query`,
    { startDate, endDate, dimensions, rowLimit }
  );
  if (!r.ok) return { error: reasonOf(r.status), rows: [] };
  return { rows: r.data?.rows ?? [] };
}

/* ---------- Сводка ---------- */

function count<T>(items: T[], key: (x: T) => string | undefined): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it) || '(пусто)';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function mdTable(headers: string[], rows: Array<Array<string | number>>): string {
  if (rows.length === 0) return '_нет данных_\n';
  const esc = (v: string | number) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n') + '\n';
}

function buildSummary(d: {
  generatedAt: string;
  period: { startDate: string; endDate: string };
  sites: { error?: string; sites: SiteEntry[] };
  sitemaps: { error?: string; sitemaps: any[] };
  sitemapNodes: SitemapNode[];
  sitemapUrls: string[];
  inspections: InspectionRow[];
  sa: {
    totals: SaRow[];
    pages: SaRow[];
    queries: SaRow[];
    devices: SaRow[];
    countries: SaRow[];
    errors: Record<string, string | undefined>;
  };
  resubmit?: { status: string; reason?: string };
}): string {
  const out: string[] = [];
  out.push(`# Аудит Search Console — ${d.generatedAt}`, '');
  out.push(`Ресурс: \`${GSC_SITE_URL}\`. Search Analytics: ${d.period.startDate} — ${d.period.endDate}.`, '');

  // 1. Ресурсы
  out.push('## 1. Ресурсы и права', '');
  if (d.sites.error) out.push(`Ошибка списка ресурсов: ${d.sites.error}`, '');
  out.push(mdTable(['siteUrl', 'permissionLevel'], d.sites.sites.map((s) => [s.siteUrl ?? '', s.permissionLevel ?? ''])));
  const urls = d.sites.sites.map((s) => s.siteUrl ?? '');
  const hasDomain = urls.includes('sc-domain:avaterra.pro');
  const prefixVariants = ['https://avaterra.pro/', 'https://www.avaterra.pro/', 'http://avaterra.pro/', 'http://www.avaterra.pro/'];
  out.push(`- Доменный ресурс \`sc-domain:avaterra.pro\`: ${hasDomain ? 'есть' : 'НЕТ'}`);
  for (const v of prefixVariants) out.push(`- Префикс \`${v}\`: ${urls.includes(v) ? 'есть' : 'нет'}`);
  out.push('');

  // 2. Sitemaps в GSC
  out.push('## 2. Sitemaps в Search Console', '');
  if (d.sitemaps.error) out.push(`Ошибка: ${d.sitemaps.error}`, '');
  out.push(
    mdTable(
      ['path', 'lastSubmitted', 'lastDownloaded', 'isPending', 'errors', 'warnings', 'contents (type: submitted/indexed)'],
      d.sitemaps.sitemaps.map((s: any) => [
        s.path ?? '',
        s.lastSubmitted ?? '',
        s.lastDownloaded ?? '',
        String(s.isPending ?? ''),
        s.errors ?? 0,
        s.warnings ?? 0,
        ((s.contents ?? []) as any[]).map((c) => `${c.type}: ${c.submitted}/${c.indexed ?? 0}`).join('; '),
      ])
    )
  );

  // 3. Живой sitemap
  out.push('## 3. Живой sitemap avaterra.pro', '');
  out.push(mdTable(['url', 'тип', 'записей', 'ошибка'], d.sitemapNodes.map((n) => [n.url, n.kind, n.count, n.error ?? ''])));
  out.push(`Уникальных URL в sitemap: **${d.sitemapUrls.length}**.`, '');

  // 4. Покрытие
  const ins = d.inspections;
  const okIns = ins.filter((i) => !i.error);
  out.push('## 4. Покрытие (URL Inspection)', '');
  out.push(`Проверено URL: ${ins.length}, с ошибкой запроса: ${ins.length - okIns.length}.`, '');
  out.push(mdTable(['coverageState', 'URL'], count(okIns, (i) => i.coverageState).map(([k, v]) => [k, v])));
  out.push(mdTable(['verdict', 'URL'], count(okIns, (i) => i.verdict).map(([k, v]) => [k, v])));

  // 5. Проблемы
  out.push('## 5. Проблемные URL', '');
  const notPass = okIns.filter((i) => i.verdict !== 'PASS');
  out.push(`### 5.1 Не проиндексированы (verdict ≠ PASS): ${notPass.length}`, '');
  out.push(mdTable(['URL', 'coverageState', 'indexingState', 'pageFetchState'], notPass.map((i) => [i.url, i.coverageState ?? '', i.indexingState ?? '', i.pageFetchState ?? ''])));

  const canonDiff = okIns.filter((i) => i.googleCanonical && i.userCanonical && i.googleCanonical !== i.userCanonical);
  out.push(`### 5.2 googleCanonical ≠ userCanonical: ${canonDiff.length}`, '');
  out.push(mdTable(['URL', 'userCanonical', 'googleCanonical'], canonDiff.map((i) => [i.url, i.userCanonical ?? '', i.googleCanonical ?? ''])));

  const robots = okIns.filter((i) => (i.robotsTxtState && i.robotsTxtState !== 'ALLOWED') || (i.indexingState && i.indexingState !== 'INDEXING_ALLOWED'));
  out.push(`### 5.3 robots.txt / noindex: ${robots.length}`, '');
  out.push(mdTable(['URL', 'robotsTxtState', 'indexingState'], robots.map((i) => [i.url, i.robotsTxtState ?? '', i.indexingState ?? ''])));

  const fetchErr = okIns.filter((i) => i.pageFetchState && i.pageFetchState !== 'SUCCESSFUL');
  out.push(`### 5.4 Ошибки загрузки (pageFetchState ≠ SUCCESSFUL): ${fetchErr.length}`, '');
  out.push(mdTable(['URL', 'pageFetchState', 'crawledAs'], fetchErr.map((i) => [i.url, i.pageFetchState ?? '', i.crawledAs ?? ''])));

  const richErr = okIns.filter((i) => i.richResults.issues.some((x) => x.startsWith('ERROR')));
  out.push(`### 5.5 Rich results с ошибками (severity ERROR): ${richErr.length}`, '');
  out.push(mdTable(['URL', 'ошибки'], richErr.map((i) => [i.url, i.richResults.issues.filter((x) => x.startsWith('ERROR')).join('; ')])));

  const mobErr = okIns.filter((i) => i.mobileUsability.verdict && i.mobileUsability.verdict !== 'PASS');
  out.push(`### 5.6 Мобильная удобность не PASS: ${mobErr.length}`, '');
  out.push(mdTable(['URL', 'verdict', 'проблемы'], mobErr.map((i) => [i.url, i.mobileUsability.verdict ?? '', i.mobileUsability.issues.join('; ')])));

  out.push(`### 5.7 Ошибки запроса инспекции: ${ins.length - okIns.length}`, '');
  out.push(mdTable(['URL', 'ошибка'], ins.filter((i) => i.error).map((i) => [i.url, i.error ?? ''])));

  // 6. Search Analytics
  const sa = d.sa;
  out.push(`## 6. Search Analytics (${d.period.startDate} — ${d.period.endDate})`, '');
  for (const [k, v] of Object.entries(sa.errors)) if (v) out.push(`Ошибка (${k}): ${v}`, '');
  const t = sa.totals[0];
  out.push(
    `Итого: клики ${t?.clicks ?? 0}, показы ${t?.impressions ?? 0}, CTR ${t ? ((t.ctr ?? 0) * 100).toFixed(2) : '0'}%, средняя позиция ${t ? (t.position ?? 0).toFixed(1) : '—'}.`,
    ''
  );

  const fmtRow = (r: SaRow, label: string) => [
    label,
    r.clicks ?? 0,
    r.impressions ?? 0,
    `${((r.ctr ?? 0) * 100).toFixed(2)}%`,
    (r.position ?? 0).toFixed(1),
  ];

  out.push('### 6.1 По устройствам', '');
  out.push(mdTable(['device', 'клики', 'показы', 'CTR', 'позиция'], sa.devices.map((r) => fmtRow(r, r.keys?.[0] ?? ''))));
  out.push('### 6.2 По странам (топ-20 по показам)', '');
  out.push(
    mdTable(
      ['country', 'клики', 'показы', 'CTR', 'позиция'],
      sa.countries.slice(0, 20).map((r) => fmtRow(r, r.keys?.[0] ?? ''))
    )
  );
  out.push('### 6.3 Топ-50 запросов (по кликам, затем по показам)', '');
  out.push(mdTable(['запрос', 'клики', 'показы', 'CTR', 'позиция'], sa.queries.map((r) => fmtRow(r, r.keys?.[0] ?? ''))));

  const sitemapSet = new Set(d.sitemapUrls);
  const pageRows = sa.pages.map((r) => ({ url: r.keys?.[0] ?? '', r }));
  const notInSitemap = pageRows.filter((p) => p.url && !sitemapSet.has(p.url));
  out.push(`### 6.4 Страницы с показами, но НЕ в sitemap: ${notInSitemap.length} из ${pageRows.length}`, '');
  out.push(
    mdTable(
      ['URL', 'клики', 'показы', 'позиция'],
      notInSitemap.slice(0, 100).map((p) => [p.url, p.r.clicks ?? 0, p.r.impressions ?? 0, (p.r.position ?? 0).toFixed(1)])
    )
  );
  out.push('### 6.5 Лучшие страницы по показам (топ-30)', '');
  out.push(
    mdTable(
      ['URL', 'клики', 'показы', 'CTR', 'позиция', 'в sitemap'],
      pageRows.slice(0, 30).map((p) => [
        p.url,
        p.r.clicks ?? 0,
        p.r.impressions ?? 0,
        `${((p.r.ctr ?? 0) * 100).toFixed(2)}%`,
        (p.r.position ?? 0).toFixed(1),
        sitemapSet.has(p.url) ? 'да' : 'нет',
      ])
    )
  );

  if (d.resubmit) {
    out.push('## 7. Повторная отправка sitemap', '');
    out.push(`PUT ${ROOT_SITEMAP}: ${d.resubmit.status}${d.resubmit.reason ? ` — ${d.resubmit.reason}` : ''}`, '');
  }
  return out.join('\n');
}

/* ---------- main ---------- */

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const endDate = addDays(todayMsk(), -LAG_DAYS);
  const startDate = addDays(endDate, -(SA_DAYS - 1));
  console.log(`Ресурс ${GSC_SITE_URL}, период ${startDate} — ${endDate}, вывод в ${OUT_DIR}`);

  // 1–2. Права и sitemaps в GSC
  const sites = await listSites();
  console.log(`ресурсов: ${sites.sites.length}${sites.error ? `, ошибка: ${sites.error}` : ''}`);
  const sitemaps = await listSitemapsRaw();
  console.log(`sitemaps в GSC: ${sitemaps.sitemaps.length}${sitemaps.error ? `, ошибка: ${sitemaps.error}` : ''}`);

  // 3. Живой sitemap
  const { nodes: sitemapNodes, urlSources } = await collectSitemapUrls(ROOT_SITEMAP);
  const sitemapUrls = [...urlSources.keys()].sort();
  console.log(`URL в sitemap: ${sitemapUrls.length}`);

  // 4. Инспекция
  const inspections = await runPool(sitemapUrls, CONCURRENCY, (u) => inspectUrl(u));
  console.log(`инспекция: готово ${inspections.length}, с ошибкой ${inspections.filter((i) => i.error).length}`);

  // 5. Search Analytics
  const sa = {
    totals: [] as SaRow[],
    pages: [] as SaRow[],
    queries: [] as SaRow[],
    devices: [] as SaRow[],
    countries: [] as SaRow[],
    errors: {} as Record<string, string | undefined>,
  };
  const totals = await searchAnalytics(startDate, endDate, [], 1);
  sa.totals = totals.rows;
  sa.errors.totals = totals.error;
  const pages = await searchAnalytics(startDate, endDate, ['page'], 25_000);
  sa.pages = pages.rows.sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
  sa.errors.pages = pages.error;
  const queries = await searchAnalytics(startDate, endDate, ['query'], 5000);
  sa.queries = queries.rows
    .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0) || (b.impressions ?? 0) - (a.impressions ?? 0))
    .slice(0, 50);
  sa.errors.queries = queries.error;
  const devices = await searchAnalytics(startDate, endDate, ['device'], 100);
  sa.devices = devices.rows;
  sa.errors.devices = devices.error;
  const countries = await searchAnalytics(startDate, endDate, ['country'], 500);
  sa.countries = countries.rows.sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
  sa.errors.countries = countries.error;
  console.log(`search analytics: страниц ${sa.pages.length}, запросов (топ) ${sa.queries.length}`);

  // 6. Единственная запись — повторная отправка sitemap (только по флагу)
  let resubmit: { status: string; reason?: string } | undefined;
  if (RESUBMIT) {
    const r = await submitSitemap(ROOT_SITEMAP);
    resubmit = r.status.state === 'ok' ? { status: 'принято (204)' } : { status: r.status.state, reason: reasonOf(r.status) };
    console.log(`resubmit sitemap: ${resubmit.status}${resubmit.reason ? ` — ${resubmit.reason}` : ''}`);
  }

  const data = {
    generatedAt,
    site: GSC_SITE_URL,
    period: { startDate, endDate },
    sites,
    sitemapsInGsc: sitemaps,
    liveSitemap: { root: ROOT_SITEMAP, nodes: sitemapNodes, urls: sitemapUrls },
    inspections,
    searchAnalytics: sa,
    resubmit,
  };

  const summary = buildSummary({
    generatedAt,
    period: { startDate, endDate },
    sites,
    sitemaps,
    sitemapNodes,
    sitemapUrls,
    inspections,
    sa,
    resubmit,
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'data.json'), JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'summary.md'), summary, 'utf8');
  console.log(`записано: ${path.join(OUT_DIR, 'data.json')}, ${path.join(OUT_DIR, 'summary.md')}`);
}

main().catch((e) => {
  console.error(`аудит прерван: ${errText(e)}`);
  process.exit(1);
});
