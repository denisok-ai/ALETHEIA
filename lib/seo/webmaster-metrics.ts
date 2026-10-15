/**
 * Коннектор Яндекс.Вебмастера для синка SEO-метрик: история индексации и
 * история показов/кликов по популярным запросам.
 *
 * Только возвращает строки SeoMetricRow — запись делает lib/seo/store.ts, оркестрация — lib/seo/sync.ts.
 * Эндпоинты (справочник Вебмастера, revision r20828935):
 *  - GET /v4/user/{uid}/hosts/{host}/indexing/history — показатели HTTP_2XX, HTTP_3XX, HTTP_4XX, HTTP_5XX, OTHER;
 *  - GET /v4/user/{uid}/hosts/{host}/search-queries/popular — топ запросов (query_id, query_text);
 *  - GET /v4/user/{uid}/hosts/{host}/search-queries/{query_id}/history — TOTAL_SHOWS, TOTAL_CLICKS по дням.
 *
 * API с 13.10.2026 не отвечает (сбой сети): это штатный исход, а не исключение.
 * Функции не бросают исключения наружу — любой сбой уходит в статус error.
 */
import { SEO_HOST, type SeoConnectorStatus, type SeoMetricRow } from './metric-types';
import { api, getWebmasterToken, hostBase, userId } from './yandex-webmaster';
import { mskIsoDate } from '@/lib/social/moscow-day';

/** Сколько популярных запросов тянем по дням (по одному запросу истории на каждый). */
const MAX_QUERIES = 20;
/** Текст статуса при сбое API (сеть, не-2xx, нет user_id). */
const UNAVAILABLE = 'API Вебмастера недоступен';

type Point = { date?: string; value?: number };
type IndicatorsBody = { indicators?: Record<string, Point[]> };

/**
 * Дата точки ответа → день по Москве (YYYY-MM-DD).
 * Формат в документации плавает: «2016-01-01T00:00:00,000+0300», «2019-07-18T00:00:00.000+03:00».
 * Без смещения считаем дату уже московской; с смещением — переводим в МСК.
 */
export function toMskDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:[.,]\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi, tz] = m;
  if (!tz) return `${y}-${mo}-${d}`;
  let offsetMin = 0;
  if (tz !== 'Z') {
    const digits = tz.slice(1).replace(':', '');
    offsetMin = (tz[0] === '-' ? -1 : 1) * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
  }
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - offsetMin * 60_000;
  return mskIsoDate(new Date(utcMs));
}

/** Параметры дат для API: границы дней по Москве, включительно. */
function dateParams(dateFrom: string, dateTo: string): URLSearchParams {
  return new URLSearchParams({
    date_from: `${dateFrom}T00:00:00+03:00`,
    date_to: `${dateTo}T23:59:59+03:00`,
  });
}

/** Точки {date, value} одного показателя → строки SeoMetricRow. Битые точки пропускаются. */
function pointsToRows(
  points: Point[] | undefined,
  dimension: 'indexing' | 'query',
  key: string,
  measure: 'pages' | 'impressions' | 'clicks',
  out: SeoMetricRow[],
): void {
  for (const p of points ?? []) {
    const date = p.date ? toMskDate(p.date) : null;
    if (!date || typeof p.value !== 'number' || !Number.isFinite(p.value)) continue;
    out.push({ host: SEO_HOST, source: 'webmaster', date, dimension, key, measure, value: p.value });
  }
}

/** История индексации: каждый HTTP-показатель → строка dimension=indexing, measure=pages. */
async function fetchIndexing(uid: number, dateFrom: string, dateTo: string): Promise<SeoMetricRow[] | null> {
  const body = await api<IndicatorsBody>(
    `${hostBase(uid)}/indexing/history?${dateParams(dateFrom, dateTo)}`,
  );
  if (!body) return null;
  const rows: SeoMetricRow[] = [];
  for (const [name, points] of Object.entries(body.indicators ?? {})) {
    pointsToRows(points, 'indexing', name.toLowerCase(), 'pages', rows);
  }
  return rows;
}

/** История показов и кликов по топ-запросам. Ошибка топа — null; сбой одного запроса — пропуск. */
async function fetchQueries(uid: number, dateFrom: string, dateTo: string): Promise<SeoMetricRow[] | null> {
  const base = hostBase(uid);
  const top = await api<{ queries?: Array<{ query_id?: string; query_text?: string }> }>(
    `${base}/search-queries/popular?${new URLSearchParams([
      ['order_by', 'TOTAL_SHOWS'],
      ['query_indicator', 'TOTAL_SHOWS'],
      ['query_indicator', 'TOTAL_CLICKS'],
      ['limit', String(MAX_QUERIES)],
    ])}`,
  );
  if (!top) return null;

  const historyQuery = `query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&${dateParams(dateFrom, dateTo)}`;

  const rows: SeoMetricRow[] = [];
  let answered = 0;
  const queries = (top.queries ?? []).filter((q) => q.query_id && q.query_text).slice(0, MAX_QUERIES);
  for (const q of queries) {
    const body = await api<IndicatorsBody>(
      `${base}/search-queries/${encodeURIComponent(q.query_id as string)}/history?${historyQuery}`,
    );
    if (!body) continue;
    answered += 1;
    const key = q.query_text as string;
    pointsToRows(body.indicators?.TOTAL_SHOWS, 'query', key, 'impressions', rows);
    pointsToRows(body.indicators?.TOTAL_CLICKS, 'query', key, 'clicks', rows);
  }
  // Топ получили, а по всем запросам история не пришла — это сбой, а не «пустые данные».
  if (queries.length > 0 && answered === 0) return null;
  return rows;
}

/**
 * Ежедневные показатели Вебмастера за период: индексация (по HTTP-показателям) и запросы.
 * Нет токена — not_configured без сетевых вызовов. Любой сбой API — error, rows пусты.
 */
export async function fetchWebmasterDaily(opts: {
  dateFrom: string;
  dateTo: string;
}): Promise<{ status: SeoConnectorStatus; rows: SeoMetricRow[] }> {
  if (!getWebmasterToken()) {
    return { status: { state: 'not_configured', reason: 'нет YANDEX_WEBMASTER_TOKEN' }, rows: [] };
  }
  const fail = { status: { state: 'error', reason: UNAVAILABLE } as SeoConnectorStatus, rows: [] };
  try {
    const uid = await userId();
    if (uid === null) return fail;

    const indexing = await fetchIndexing(uid, opts.dateFrom, opts.dateTo);
    if (indexing === null) return fail;
    const queries = await fetchQueries(uid, opts.dateFrom, opts.dateTo);
    if (queries === null) return fail;

    return { status: { state: 'ok' }, rows: [...indexing, ...queries] };
  } catch (e) {
    console.warn('[webmaster-metrics] сбой синка:', e instanceof Error ? e.name : 'неизвестная ошибка');
    return fail;
  }
}
