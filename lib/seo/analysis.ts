/**
 * Анализ SEO-метрик (план docs/Plan-SEO-Social-2026-10.md, этап 2: T2.1–T2.4).
 *
 * Чистые функции над строками SeoMetricRow: без БД и сети, поэтому тестируются
 * без SQLite. Образец логики — Magic Master: backend/app/seo/analysis.py.
 *
 * Правила:
 *  - каждая функция работает с одним source (gsc / webmaster); цифры разных источников не смешиваем;
 *  - малые выборки не интерпретируем: ниже порога показов результат пустой («мало данных»),
 *    а не «падение»;
 *  - позиция усредняется по показам: средняя позиция запроса — взвешенное по показам среднее по дням.
 */
import type { SeoDimension, SeoMetricRow, SeoSource } from './metric-types';

/** Агрегат по ключу (запрос, страница или пусто для итога по сайту) за период. */
export type SeoAgg = {
  key: string;
  clicks: number;
  impressions: number;
  /** Средняя позиция, взвешенная по показам; null, если показов не было. */
  position: number | null;
};

/** Корзины средней позиции (округлённая позиция): 1–3, 4–10, 11–20, 21+. */
export const POSITION_BUCKETS = ['1–3', '4–10', '11–20', '21+'] as const;
export type PositionBucket = (typeof POSITION_BUCKETS)[number];

/** Позиция для корзин и отбора: GSC отдаёт дробные значения, сравниваем округлённые. */
export function roundPosition(position: number): number {
  return Math.round(position);
}

/** Разделитель запроса и страницы в ключе dimension=query_page. В запросах GSC табуляции нет. */
const QUERY_PAGE_SEP = '\t';

/** Ключ пары «запрос × страница» для dimension=query_page: `${query}\t${page}`. */
export function queryPageKey(query: string, page: string): string {
  return `${query}${QUERY_PAGE_SEP}${page}`;
}

/** Обратно к паре; null, если разделителя нет (ключ не из query_page). */
export function splitQueryPageKey(key: string): { query: string; page: string } | null {
  const i = key.indexOf(QUERY_PAGE_SEP);
  if (i < 0) return null;
  return { query: key.slice(0, i), page: key.slice(i + 1) };
}

/**
 * Пары запрос–страница с суммой показов за период: вход для opportunities.pairs.
 * Показы суммируются по дням до выбора «главной» страницы для запроса.
 */
export function queryPagePairs(rows: SeoMetricRow[]): Array<{ query: string; page: string; impressions: number }> {
  const out: Array<{ query: string; page: string; impressions: number }> = [];
  for (const a of aggregate(rows, 'gsc', 'query_page')) {
    const pair = splitQueryPageKey(a.key);
    if (pair && pair.page) out.push({ ...pair, impressions: a.impressions });
  }
  return out;
}

/** Суммирует строки одного source/dimension по ключу за период. */
export function aggregate(rows: SeoMetricRow[], source: SeoSource, dimension: SeoDimension): SeoAgg[] {
  // Сначала — по (дата, ключ): позиция и показы одного дня связываются между собой.
  const cells = new Map<string, { key: string; clicks: number; impressions: number; position: number }>();
  for (const r of rows) {
    if (r.source !== source || r.dimension !== dimension) continue;
    const id = `${r.date}\u0000${r.key}`;
    let cell = cells.get(id);
    if (!cell) {
      cell = { key: r.key, clicks: 0, impressions: 0, position: 0 };
      cells.set(id, cell);
    }
    if (r.measure === 'clicks') cell.clicks += r.value;
    else if (r.measure === 'impressions') cell.impressions += r.value;
    else if (r.measure === 'position') cell.position = r.value;
  }

  // Затем — по ключу: позиция взвешена показами каждого дня.
  const byKey = new Map<string, { clicks: number; impressions: number; weighted: number; weight: number }>();
  for (const cell of cells.values()) {
    const acc = byKey.get(cell.key) ?? { clicks: 0, impressions: 0, weighted: 0, weight: 0 };
    acc.clicks += cell.clicks;
    acc.impressions += cell.impressions;
    if (cell.position > 0 && cell.impressions > 0) {
      acc.weighted += cell.position * cell.impressions;
      acc.weight += cell.impressions;
    }
    byKey.set(cell.key, acc);
  }

  return [...byKey.entries()]
    .map(([key, acc]) => ({
      key,
      clicks: acc.clicks,
      impressions: acc.impressions,
      position: acc.weight > 0 ? acc.weighted / acc.weight : null,
    }))
    .sort((a, b) => b.impressions - a.impressions || a.key.localeCompare(b.key));
}

/** Итог по сайту за период (строка dimension=total). */
export function totalAgg(rows: SeoMetricRow[], source: SeoSource): SeoAgg {
  return aggregate(rows, source, 'total')[0] ?? { key: '', clicks: 0, impressions: 0, position: null };
}

/**
 * Распределение запросов GSC по средней позиции за период.
 * Запросы без позиции (ни одного показа) считаются отдельно в withoutPosition.
 */
export function positionBuckets(rows: SeoMetricRow[]): {
  buckets: Record<PositionBucket, { queries: number; impressions: number }>;
  withoutPosition: number;
} {
  const buckets = Object.fromEntries(
    POSITION_BUCKETS.map((b) => [b, { queries: 0, impressions: 0 }]),
  ) as Record<PositionBucket, { queries: number; impressions: number }>;
  let withoutPosition = 0;
  for (const q of aggregate(rows, 'gsc', 'query')) {
    if (q.position === null) {
      withoutPosition += 1;
      continue;
    }
    const p = roundPosition(q.position);
    const bucket: PositionBucket = p <= 3 ? '1–3' : p <= 10 ? '4–10' : p <= 20 ? '11–20' : '21+';
    buckets[bucket].queries += 1;
    buckets[bucket].impressions += q.impressions;
  }
  return { buckets, withoutPosition };
}

export type RegressionOpts = {
  /** Что сравниваем: запросы или страницы. */
  dimension?: 'query' | 'page';
  /** Порог показов за прошлую неделю (база сравнения должна быть измеримой). */
  minImpressions?: number;
  /** На сколько позиций должна ухудшиться средняя позиция (больше = хуже). */
  minPositionDrop?: number;
  /** Относительное падение клики/показы, с которого считаем «существенным». */
  dropRatio?: number;
};

export type Regression = {
  key: string;
  previous: { clicks: number; impressions: number; position: number };
  current: { clicks: number; impressions: number; position: number };
  positionDelta: number;
  reasons: Array<'clicks' | 'impressions'>;
};

/**
 * Регрессии неделя к неделе: клики или показы упали не меньше dropRatio, позиция
 * ухудшилась не меньше minPositionDrop. Срабатывает только при показах прошлой
 * недели ≥ minImpressions. Запросы без позиции в текущей неделе пропускаем:
 * «ухудшение позиции» для них не измерить.
 */
export function regressions(
  current: SeoMetricRow[],
  previous: SeoMetricRow[],
  opts: RegressionOpts = {},
): Regression[] {
  const dimension = opts.dimension ?? 'query';
  const minImpressions = opts.minImpressions ?? 20;
  const minPositionDrop = opts.minPositionDrop ?? 3;
  const dropRatio = opts.dropRatio ?? 0.5;

  const cur = new Map(aggregate(current, 'gsc', dimension).map((a) => [a.key, a]));
  const out: Regression[] = [];
  for (const prev of aggregate(previous, 'gsc', dimension)) {
    if (prev.impressions < minImpressions || prev.position === null) continue;
    const now = cur.get(prev.key);
    if (!now || now.position === null) continue;

    const reasons: Regression['reasons'] = [];
    if (prev.clicks > 0 && now.clicks <= prev.clicks * (1 - dropRatio)) reasons.push('clicks');
    if (now.impressions <= prev.impressions * (1 - dropRatio)) reasons.push('impressions');
    if (reasons.length === 0) continue;

    const positionDelta = now.position - prev.position;
    if (positionDelta < minPositionDrop) continue;

    out.push({
      key: prev.key,
      previous: { clicks: prev.clicks, impressions: prev.impressions, position: prev.position },
      current: { clicks: now.clicks, impressions: now.impressions, position: now.position },
      positionDelta,
      reasons,
    });
  }
  return out.sort((a, b) => b.previous.impressions - a.previous.impressions || a.key.localeCompare(b.key));
}

export type CtrOutlierOpts = {
  dimension?: 'query' | 'page';
  /** Порог показов: ниже — выборка мала, выброса не видим. */
  minImpressions?: number;
  /**
   * Ключи, которые трогать нельзя (например, страницы, уже дающие клики за более
   * длинную историю). Правило плана: title страниц с кликами не меняем.
   */
  protectedKeys?: ReadonlySet<string>;
};

/**
 * CTR-выбросы: показы есть, кликов нет — кандидаты на правку сниппета (title/description).
 * Для страниц protectedKeys обязателен к передаче: страницы с кликами в список не попадают.
 */
export function ctrOutliers(rows: SeoMetricRow[], opts: CtrOutlierOpts = {}): SeoAgg[] {
  const dimension = opts.dimension ?? 'page';
  const minImpressions = opts.minImpressions ?? 20;
  return aggregate(rows, 'gsc', dimension).filter(
    (a) => a.impressions >= minImpressions && a.clicks === 0 && !opts.protectedKeys?.has(a.key),
  );
}

export type OpportunityOpts = {
  /** Порог показов за период (по умолчанию 28 дней). */
  minImpressions?: number;
  /** Диапазон округлённой средней позиции. */
  minPosition?: number;
  maxPosition?: number;
  /**
   * Пары запрос–страница с показами (разрез GSC «запрос × страница»). Страница
   * для запроса — с максимальными показами. Без пар страница останется null.
   */
  pairs?: Array<{ query: string; page: string; impressions: number }>;
};

export type Opportunity = {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  page: string | null;
};

/** «Шахтёр возможностей»: запросы с показами на позициях 6–20 — кандидаты в темы недели. */
export function opportunities(rows: SeoMetricRow[], opts: OpportunityOpts = {}): Opportunity[] {
  const minImpressions = opts.minImpressions ?? 5;
  const minPosition = opts.minPosition ?? 6;
  const maxPosition = opts.maxPosition ?? 20;

  const bestPage = new Map<string, { page: string; impressions: number }>();
  for (const p of opts.pairs ?? []) {
    const cur = bestPage.get(p.query);
    if (!cur || p.impressions > cur.impressions) bestPage.set(p.query, { page: p.page, impressions: p.impressions });
  }

  return aggregate(rows, 'gsc', 'query')
    .filter((q) => {
      if (q.position === null || q.impressions < minImpressions) return false;
      const p = roundPosition(q.position);
      return p >= minPosition && p <= maxPosition;
    })
    .map((q) => ({
      query: q.key,
      impressions: q.impressions,
      clicks: q.clicks,
      position: q.position as number,
      page: bestPage.get(q.key)?.page ?? null,
    }))
    .sort((a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query));
}

/** Минимальная база индексации (страниц http_2xx), с которой сравниваем падение; меньше — молчим. */
export const WATCHDOG_MIN_INDEXED_PAGES = 20;

/**
 * Страниц, успешно загруженных роботом (Вебмастер, key=http_2xx), на последний день периода;
 * null, если данных нет. Значения http_3xx/4xx/5xx/other сюда не попадают.
 */
function indexingValue(rows: SeoMetricRow[]): number | null {
  const idx = rows.filter((r) => r.source === 'webmaster' && r.dimension === 'indexing' && r.key === 'http_2xx');
  if (idx.length === 0) return null;
  const last = idx.reduce((max, r) => (r.date > max ? r.date : max), idx[0].date);
  return idx.filter((r) => r.date === last).reduce((sum, r) => sum + r.value, 0);
}

/**
 * Сторож: тревоги за неделю против прошлой недели.
 *  - GSC: клики или показы упали ≥ 50 %, при показах прошлой недели ≥ 50;
 *  - индексация (Вебмастер, http_2xx — страницы, успешно загруженные роботом): упала ≥ 20 %,
 *    при базе прошлой недели ≥ WATCHDOG_MIN_INDEXED_PAGES страниц.
 * Если данных за текущую неделю нет вовсе — молчим: это проблема синка (см. журнал синков), не падение.
 */
export function seoWatchdog(current: SeoMetricRow[], previous: SeoMetricRow[]): string[] {
  const alerts: string[] = [];
  const hasGscWeek = current.some((r) => r.source === 'gsc' && r.dimension === 'total');
  const cur = totalAgg(current, 'gsc');
  const prev = totalAgg(previous, 'gsc');
  if (hasGscWeek && prev.impressions >= 50) {
    if (cur.impressions <= prev.impressions * 0.5) {
      alerts.push(`GSC: показы за неделю упали с ${Math.round(prev.impressions)} до ${Math.round(cur.impressions)}`);
    }
    if (prev.clicks > 0 && cur.clicks <= prev.clicks * 0.5) {
      alerts.push(`GSC: клики за неделю упали с ${Math.round(prev.clicks)} до ${Math.round(cur.clicks)}`);
    }
  }

  const idxCur = indexingValue(current);
  const idxPrev = indexingValue(previous);
  if (idxCur !== null && idxPrev !== null && idxPrev >= WATCHDOG_MIN_INDEXED_PAGES && idxCur <= idxPrev * 0.8) {
    alerts.push(`Яндекс: страниц, загруженных роботом, стало ${idxCur} (было ${idxPrev})`);
  }
  return alerts;
}
