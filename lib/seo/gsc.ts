/**
 * Коннектор Google Search Console: Search Analytics API и карта сайта (sitemaps).
 *
 * Только возвращает строки SeoMetricRow — запись в БД делает lib/seo/store.ts.
 * Данные GSC запаздывают на 2–3 дня; пустой ответ на малом трафике — норма, а не ошибка.
 * Функции не бросают исключения наружу: любая проблема уходит в поле status.
 */
import { getGoogleAccessToken, resetGoogleTokenCache } from './google-oauth';
import { SEO_HOST, type SeoConnectorStatus, type SeoDimension, type SeoMetricRow } from './metric-types';
import { queryPageKey } from './analysis';

const API = 'https://www.googleapis.com/webmasters/v3';
/** Ресурс аккаунта — префиксный (https://avaterra.pro/). Доменного sc-domain: пока нет. */
export const GSC_SITE_URL = 'https://avaterra.pro/';
const DEFAULT_ROW_LIMIT = 5000;
/** Максимум строк одним запросом у API. */
const MAX_ROW_LIMIT = 25000;
/**
 * Предохранитель пагинации: 5 страниц по 5000 строк на разрез. Упёрлись в него — хвост молча
 * не забираем: для query_page за длинный период это возможно, см. отчёт про объём строк.
 */
const MAX_PAGES = 5;
const TIMEOUT_MS = 20_000;

type ApiRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
type SearchAnalyticsResponse = { rows?: ApiRow[] };

type Slice = { dimensions: Array<'date' | 'query' | 'page'>; dimension: SeoDimension };

/** Разрезы: итог за день, запросы, страницы и пары «запрос × страница» по дням. */
const SLICES: Slice[] = [
  { dimensions: ['date'], dimension: 'total' },
  { dimensions: ['date', 'query'], dimension: 'query' },
  { dimensions: ['date', 'page'], dimension: 'page' },
  { dimensions: ['date', 'query', 'page'], dimension: 'query_page' },
];

export type SitemapInfo = {
  path: string;
  lastSubmitted: string;
  isPending: boolean;
  errors: number;
  warnings: number;
};

type Result<T> = { ok: true; data: T } | { ok: false; status: SeoConnectorStatus };

function errName(e: unknown): string {
  return e instanceof Error ? e.name : 'неизвестная ошибка';
}

/** Понятный текст по коду HTTP. Тело ответа не выводим: там бывают детали запроса. */
function httpStatusError(code: number): SeoConnectorStatus {
  if (code === 401 || code === 403) {
    return {
      state: 'error',
      reason: `нет доступа к ресурсу Search Console (HTTP ${code}): проверь права аккаунта и scope webmasters`,
    };
  }
  if (code === 429) {
    return { state: 'error', reason: 'квота Search Console исчерпана (HTTP 429), повторим позже' };
  }
  return { state: 'error', reason: `Search Console вернул HTTP ${code}` };
}

/** Один вызов Search Console API с токеном. 204 возвращает data = null. */
async function gscCall<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<Result<T | null>> {
  const auth = await getGoogleAccessToken();
  if (!auth.token) return { ok: false, status: auth.status };

  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth.token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 401 — токен мог протухнуть раньше срока: сбрасываем кеш, следующий вызов возьмёт новый.
      if (res.status === 401) resetGoogleTokenCache();
      return { ok: false, status: httpStatusError(res.status) };
    }
    if (res.status === 204) return { ok: true, data: null };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    return { ok: false, status: { state: 'error', reason: `запрос к Search Console не удался: ${errName(e)}` } };
  }
}

function siteBase(siteUrl: string): string {
  return `/sites/${encodeURIComponent(siteUrl)}`;
}

/** Все страницы одного разреза; останавливаемся на неполной странице или на MAX_PAGES. */
async function fetchSlice(
  siteUrl: string,
  slice: Slice,
  dateFrom: string,
  dateTo: string,
  rowLimit: number
): Promise<Result<ApiRow[]>> {
  const out: ApiRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await gscCall<SearchAnalyticsResponse>('POST', `${siteBase(siteUrl)}/searchAnalytics/query`, {
      startDate: dateFrom,
      endDate: dateTo,
      dimensions: slice.dimensions,
      rowLimit,
      startRow: page * rowLimit,
    });
    if (!r.ok) return r;
    const batch = r.data?.rows ?? [];
    out.push(...batch);
    if (batch.length < rowLimit) break;
  }
  return { ok: true, data: out };
}

/** Строка API → четыре SeoMetricRow (clicks, impressions, ctr, position). */
function mapRows(apiRows: ApiRow[], slice: Slice): SeoMetricRow[] {
  const out: SeoMetricRow[] = [];
  for (const row of apiRows) {
    const keys = row.keys ?? [];
    const date = keys[0] ?? '';
    if (!date) continue;
    // Для total ключ пустой; для query/page ключ — второе измерение строки;
    // для query_page — пара «запрос\tстраница». Строка без пары не нужна.
    let key = '';
    if (slice.dimension === 'query_page') {
      if (!keys[1] || !keys[2]) continue;
      key = queryPageKey(keys[1], keys[2]);
    } else if (slice.dimension !== 'total') {
      key = keys[1] ?? '';
    }
    const measures = [
      ['clicks', row.clicks],
      ['impressions', row.impressions],
      ['ctr', row.ctr],
      ['position', row.position],
    ] as const;
    for (const [measure, value] of measures) {
      out.push({
        host: SEO_HOST,
        source: 'gsc',
        date,
        dimension: slice.dimension,
        key,
        measure,
        value: Number(value ?? 0),
      });
    }
  }
  return out;
}

/**
 * Ежедневные показатели GSC за период (финальные данные, не dataState 'all').
 * Четыре разреза: total, query, page, query_page. Ошибка любого разреза — status error, rows пусты.
 */
export async function fetchGscDaily(opts: {
  dateFrom: string;
  dateTo: string;
  siteUrl?: string;
  rowLimit?: number;
}): Promise<{ status: SeoConnectorStatus; rows: SeoMetricRow[] }> {
  const siteUrl = opts.siteUrl ?? GSC_SITE_URL;
  const rowLimit = Math.min(Math.max(1, opts.rowLimit ?? DEFAULT_ROW_LIMIT), MAX_ROW_LIMIT);

  const rows: SeoMetricRow[] = [];
  for (const slice of SLICES) {
    const r = await fetchSlice(siteUrl, slice, opts.dateFrom, opts.dateTo, rowLimit);
    if (!r.ok) return { status: r.status, rows: [] };
    rows.push(...mapRows(r.data, slice));
  }
  return { status: { state: 'ok' }, rows };
}

/** Список sitemap-файлов ресурса. При ошибке sitemaps пуст. */
export async function listSitemaps(
  siteUrl: string = GSC_SITE_URL
): Promise<{ status: SeoConnectorStatus; sitemaps: SitemapInfo[] }> {
  const r = await gscCall<{
    sitemap?: Array<{ path?: string; lastSubmitted?: string; isPending?: boolean; errors?: string | number; warnings?: string | number }>;
  }>('GET', `${siteBase(siteUrl)}/sitemaps`);
  if (!r.ok) return { status: r.status, sitemaps: [] };

  const sitemaps = (r.data?.sitemap ?? []).map((s) => ({
    path: s.path ?? '',
    lastSubmitted: s.lastSubmitted ?? '',
    isPending: Boolean(s.isPending),
    // API отдаёт счётчики строками (int64), приводим к числу.
    errors: Number(s.errors ?? 0),
    warnings: Number(s.warnings ?? 0),
  }));
  return { status: { state: 'ok' }, sitemaps };
}

/** Отправить sitemap на обработку (PUT). status ok — принят. */
export async function submitSitemap(
  feedpath: string,
  siteUrl: string = GSC_SITE_URL
): Promise<{ status: SeoConnectorStatus }> {
  const r = await gscCall<null>('PUT', `${siteBase(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`);
  if (!r.ok) return { status: r.status };
  return { status: { state: 'ok' } };
}
