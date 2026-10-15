/**
 * Недельный SEO-дайджест владельцу в Telegram (T2.3, план docs/Plan-SEO-Social-2026-10.md).
 *
 * Читает SeoMetric (store.ts), журнал синков и продажи/заявки из БД, анализ —
 * из analysis.ts. Цифры разных источников не смешиваем: GSC, Метрика и Вебмастер
 * в отдельных строках. GSC отстаёт на 2 дня, поэтому его окна сдвинуты.
 *
 * Тексты короткие, для Telegram; при малых данных пишем «мало данных», а не «падение».
 */
import { prisma } from '@/lib/db';
import { getSeoMetrics, lastSeoSyncRuns, type SeoSyncRunInfo } from './store';
import type { SeoDimension, SeoMetricRow, SeoSource } from './metric-types';
import {
  ctrOutliers,
  opportunities,
  positionBuckets,
  POSITION_BUCKETS,
  regressions,
  seoWatchdog,
  totalAgg,
  type Opportunity,
  type PositionBucket,
  type Regression,
  type SeoAgg,
} from './analysis';
import { networkForRef } from '@/lib/social/refs';

/** Порог показов за неделю, ниже которого сравнения GSC не интерпретируем. */
export const MIN_WEEK_IMPRESSIONS = 20;
/** Порог визитов за неделю для Метрики. */
export const MIN_WEEK_VISITS = 20;

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Подписи сетей для текста (код сети из lib/social/refs.ts). */
const NETWORK_LABEL: Record<string, string> = {
  telegram: 'Telegram',
  max: 'MAX',
  vk: 'VK',
  youtube: 'YouTube',
  rutube: 'RuTube',
  dzen: 'Дзен',
  instagram: 'Instagram',
};

/** Подписи источников трафика Метрики. */
const TRAFFIC_LABEL: Record<string, string> = {
  organic: 'поиск',
  direct: 'прямой',
  referral: 'ссылки',
  social: 'соцсети',
  ad: 'реклама',
};

const SOURCE_LABEL: Record<string, string> = { gsc: 'GSC', metrika: 'Метрика', webmaster: 'Вебмастер' };

/** Календарная дата по Москве (без перехода на летнее время: МСК = UTC+3 круглый год). */
export function mskDate(now: Date): string {
  return new Date(now.getTime() + MSK_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Начало календарного дня по Москве как момент времени. */
function mskStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+03:00`);
}

/** YYYY-MM-DD → DD.MM. */
function dm(ymd: string): string {
  return `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}`;
}

type Range = { from: string; to: string };

function inRange(rows: SeoMetricRow[], range: Range): SeoMetricRow[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to);
}

/** Сумма показателя по ключу (визиты по источникам, цели и т.п.). */
function sumByKey(rows: SeoMetricRow[], source: SeoSource, dimension: SeoDimension, measure: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.source !== source || r.dimension !== dimension || r.measure !== measure) continue;
    out.set(r.key, (out.get(r.key) ?? 0) + r.value);
  }
  return out;
}

function sumOf(map: Map<string, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

/** Сумма в рублях с пробелами между разрядами: 9980 → «9 980». */
export function formatRub(amount: number): string {
  return `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}

function fmtNum(n: number): string {
  return String(Math.round(n));
}

function fmtPos(p: number | null): string {
  return p === null ? '—' : p.toFixed(1);
}

/**
 * Канал по метке первого касания: сеть из метки, «без метки» для пустой,
 * «прочее» для непустой, но не распознанной метки.
 */
export function channelOf(acqRef: string | null | undefined): string {
  if (!acqRef) return 'без метки';
  const network = networkForRef(acqRef);
  if (!network) return 'прочее';
  return NETWORK_LABEL[network] ?? network;
}

function syncWarning(source: SeoSource, run: SeoSyncRunInfo | undefined, webmasterEverOk: boolean): string | null {
  const label = SOURCE_LABEL[source];
  if (run?.state === 'ok') return null;
  if (source === 'webmaster' && !webmasterEverOk) {
    // API Вебмастера недоступен: спокойная строка без ⚠️, без тревог (сторож по индексации молчит).
    return 'Вебмастер: API Яндекса недоступен, данные не собираются';
  }
  if (!run) return `⚠️ ${label}: синков ещё не было`;
  if (run.state === 'not_configured') return `⚠️ ${label}: не настроен`;
  const detail = run.message ? ` (${run.message.slice(0, 120)})` : '';
  return `⚠️ ${label}: ошибка синка${detail}`;
}

function pickTopRegressions(list: Regression[], n: number): string[] {
  return list.slice(0, n).map((r) => {
    const pos = `поз. ${r.previous.position.toFixed(1)}→${r.current.position.toFixed(1)}`;
    const shows = `показы ${fmtNum(r.previous.impressions)}→${fmtNum(r.current.impressions)}`;
    return `· «${r.key.slice(0, 60)}»: ${shows}, ${pos}`;
  });
}

export type SeoWeeklyDigestData = {
  period: { weekMsk: Range; gscWeek: Range; gscPrevWeek: Range; metrikaWeek: Range; metrikaPrevWeek: Range };
  gsc: { current: SeoAgg; previous: SeoAgg; enough: boolean };
  positions: { buckets: Record<PositionBucket, { queries: number; impressions: number }>; withoutPosition: number };
  regressions: { queries: Regression[]; pages: Regression[] };
  ctrOutliers: SeoAgg[];
  opportunities: Opportunity[];
  metrika: {
    visits: number;
    visitsPrevious: number;
    enough: boolean;
    trafficSources: Array<[string, number]>;
    goals: Array<[string, number]>;
  };
  syncRuns: Record<string, SeoSyncRunInfo>;
  alerts: string[];
  sales: { count: number; revenue: number; byChannel: Array<{ channel: string; count: number; revenue: number }> };
  leads: { count: number; byChannel: Array<[string, number]> };
};

/**
 * Собирает недельный дайджест. now — момент отправки (крон в понедельник 09:15 МСК).
 * Окна: GSC — последние 7 дней с лагом 2 дня, Метрика и продажи — 7 полных дней до вчера.
 */
export async function buildSeoWeeklyDigest(now: Date): Promise<{ lines: string[]; data: SeoWeeklyDigestData }> {
  const today = mskDate(now);
  const gscEnd = addDays(today, -2);
  const metEnd = addDays(today, -1);
  const gscWeek: Range = { from: addDays(gscEnd, -6), to: gscEnd };
  const gscPrevWeek: Range = { from: addDays(gscEnd, -13), to: addDays(gscEnd, -7) };
  const metrikaWeek: Range = { from: addDays(metEnd, -6), to: metEnd };
  const metrikaPrevWeek: Range = { from: addDays(metEnd, -13), to: addDays(metEnd, -7) };
  // 28 дней GSC для возможностей; недельные окна режем из той же выборки.
  const gsc28: Range = { from: addDays(gscEnd, -27), to: gscEnd };
  const met14: Range = { from: metrikaPrevWeek.from, to: metrikaWeek.to };

  const [gscTotal, gscQuery, gscPage, webmasterIdx, metTotal, metSources, metGoals, syncRuns, webmasterOkCount] = await Promise.all([
    getSeoMetrics({ source: 'gsc', dimension: 'total', dateFrom: gsc28.from, dateTo: gsc28.to }),
    getSeoMetrics({ source: 'gsc', dimension: 'query', dateFrom: gsc28.from, dateTo: gsc28.to }),
    getSeoMetrics({ source: 'gsc', dimension: 'page', dateFrom: gsc28.from, dateTo: gsc28.to }),
    getSeoMetrics({ source: 'webmaster', dimension: 'indexing', dateFrom: gscPrevWeek.from, dateTo: gscWeek.to }),
    getSeoMetrics({ source: 'metrika', dimension: 'total', dateFrom: met14.from, dateTo: met14.to }),
    getSeoMetrics({ source: 'metrika', dimension: 'traffic_source', dateFrom: metrikaWeek.from, dateTo: metrikaWeek.to }),
    getSeoMetrics({ source: 'metrika', dimension: 'goal', dateFrom: metrikaWeek.from, dateTo: metrikaWeek.to }),
    lastSeoSyncRuns(),
    prisma.seoSyncRun.count({ where: { source: 'webmaster', state: 'ok' } }),
  ]);
  const webmasterEverOk = webmasterOkCount > 0;

  // Продажи и заявки за 7 полных дней до вчера (как окно Метрики).
  const [paid, leads] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: mskStart(metrikaWeek.from), lt: mskStart(addDays(metrikaWeek.to, 1)) },
      },
      select: { acqRef: true, amount: true },
    }),
    prisma.lead.findMany({
      where: { createdAt: { gte: mskStart(metrikaWeek.from), lt: mskStart(addDays(metrikaWeek.to, 1)) } },
      select: { acqRef: true },
    }),
  ]);

  // --- GSC ---
  const gscCurRows = inRange(gscTotal, gscWeek);
  const gscPrevRows = inRange(gscTotal, gscPrevWeek);
  const gscCur = totalAgg(gscCurRows, 'gsc');
  const gscPrev = totalAgg(gscPrevRows, 'gsc');
  const gscEnough = gscCur.impressions >= MIN_WEEK_IMPRESSIONS;

  const queryWeek = inRange(gscQuery, gscWeek);
  const queryPrevWeek = inRange(gscQuery, gscPrevWeek);
  const pageWeek = inRange(gscPage, gscWeek);
  const pagePrevWeek = inRange(gscPage, gscPrevWeek);
  const positions = positionBuckets(queryWeek);
  const regQueries = regressions(queryWeek, queryPrevWeek, { dimension: 'query', minImpressions: MIN_WEEK_IMPRESSIONS });
  const regPages = regressions(pageWeek, pagePrevWeek, { dimension: 'page', minImpressions: MIN_WEEK_IMPRESSIONS });
  // Страницы с кликами за оба окна не трогаем (правило плана: title с кликами не меняем).
  const protectedPages = new Set(
    [...pageWeek, ...pagePrevWeek].filter((r) => r.measure === 'clicks' && r.value > 0).map((r) => r.key),
  );
  const outliers = ctrOutliers(pageWeek, { dimension: 'page', minImpressions: MIN_WEEK_IMPRESSIONS, protectedKeys: protectedPages });
  const opps = opportunities(gscQuery, { minImpressions: 5 }).slice(0, 5);

  // --- Метрика ---
  const visitsCur = sumOf(sumByKey(inRange(metTotal, metrikaWeek), 'metrika', 'total', 'visits'));
  const visitsPrev = sumOf(sumByKey(inRange(metTotal, metrikaPrevWeek), 'metrika', 'total', 'visits'));
  const sources = [...sumByKey(metSources, 'metrika', 'traffic_source', 'visits').entries()].sort((a, b) => b[1] - a[1]);
  const goals = [...sumByKey(metGoals, 'metrika', 'goal', 'reaches').entries()].sort((a, b) => b[1] - a[1]);

  // --- Продажи и заявки ---
  const salesByChannel = new Map<string, { count: number; revenue: number }>();
  for (const o of paid) {
    const ch = channelOf(o.acqRef);
    const acc = salesByChannel.get(ch) ?? { count: 0, revenue: 0 };
    acc.count += 1;
    acc.revenue += o.amount;
    salesByChannel.set(ch, acc);
  }
  const salesList = [...salesByChannel.entries()]
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const leadsByChannel = new Map<string, number>();
  for (const l of leads) {
    const ch = channelOf(l.acqRef);
    leadsByChannel.set(ch, (leadsByChannel.get(ch) ?? 0) + 1);
  }

  // --- Тревоги сторожа: текущая неделя против прошлой ---
  const alerts = seoWatchdog(
    [...gscCurRows, ...inRange(webmasterIdx, gscWeek)],
    [...gscPrevRows, ...inRange(webmasterIdx, gscPrevWeek)],
  );

  const data: SeoWeeklyDigestData = {
    period: { weekMsk: metrikaWeek, gscWeek, gscPrevWeek, metrikaWeek, metrikaPrevWeek },
    gsc: { current: gscCur, previous: gscPrev, enough: gscEnough },
    positions,
    regressions: { queries: regQueries, pages: regPages },
    ctrOutliers: outliers,
    opportunities: opps,
    metrika: {
      visits: visitsCur,
      visitsPrevious: visitsPrev,
      enough: visitsCur >= MIN_WEEK_VISITS,
      trafficSources: sources,
      goals,
    },
    syncRuns,
    alerts,
    sales: {
      count: paid.length,
      revenue: paid.reduce((s, o) => s + o.amount, 0),
      byChannel: salesList,
    },
    leads: { count: leads.length, byChannel: [...leadsByChannel.entries()].sort((a, b) => b[1] - a[1]) },
  };

  const body: string[] = [];
  body.push(
    `Период: ${dm(metrikaWeek.from)}–${dm(metrikaWeek.to)} · поиск (GSC) — ${dm(gscWeek.from)}–${dm(gscWeek.to)}, лаг 2 дня`,
  );

  for (const source of ['gsc', 'metrika', 'webmaster'] as const) {
    const warning = syncWarning(source, syncRuns[source], webmasterEverOk);
    if (warning) body.push(warning);
  }

  if (gscEnough) {
    body.push(
      `GSC (поиск): показы ${fmtNum(gscCur.impressions)} (было ${fmtNum(gscPrev.impressions)}), клики ${fmtNum(gscCur.clicks)} (было ${fmtNum(gscPrev.clicks)}), средняя позиция ${fmtPos(gscCur.position)}`,
    );
  } else {
    body.push(`GSC: мало данных (показов за неделю: ${fmtNum(gscCur.impressions)})`);
  }

  if (gscEnough) {
    const parts = POSITION_BUCKETS.map((b) => `${b} — ${positions.buckets[b].queries} зап./${fmtNum(positions.buckets[b].impressions)} пок.`);
    body.push(`Позиции запросов: ${parts.join(' · ')}`);
  } else {
    body.push('Позиции запросов: мало данных');
  }

  const regAll = [...regQueries.slice(0, 3), ...regPages.slice(0, 2)];
  if (gscEnough && regQueries.length + regPages.length === 0) {
    body.push('Падений при достаточных показах нет');
  } else if (!gscEnough) {
    body.push('Падения: мало данных для сравнения');
  } else {
    body.push('Падения (показы от 20 на прошлой неделе):', ...pickTopRegressions(regAll, 5));
  }

  if (visitsCur >= MIN_WEEK_VISITS) {
    body.push(`Метрика: визиты ${fmtNum(visitsCur)} (было ${fmtNum(visitsPrev)})`);
  } else {
    body.push(`Метрика: мало данных (визитов за неделю: ${fmtNum(visitsCur)})`);
  }
  if (sources.length > 0) {
    body.push(
      `Источники: ${sources
        .slice(0, 4)
        .map(([k, v]) => `${TRAFFIC_LABEL[k] ?? k} ${fmtNum(v)}`)
        .join(' · ')}`,
    );
  }
  if (goals.length > 0) {
    body.push(`Цели: ${goals.slice(0, 5).map(([k, v]) => `цель ${k} — ${fmtNum(v)}`).join(' · ')}`);
  }

  if (salesList.length === 0) {
    body.push('Продажи за неделю: оплат нет');
  } else {
    body.push(`Продажи за неделю: ${paid.length} шт. на ${formatRub(data.sales.revenue)}`);
    for (const s of salesList) body.push(`· ${s.channel}: ${s.count} шт., ${formatRub(s.revenue)}`);
  }
  if (leads.length === 0) {
    body.push('Заявки за неделю: нет');
  } else {
    body.push(
      `Заявки за неделю: ${leads.length} (${data.leads.byChannel.map(([c, n]) => `${c} ${n}`).join(' · ')})`,
    );
  }

  if (opps.length > 0) {
    body.push('', 'Темы недели (запросы на 6–20 месте, 28 дней):');
    for (const o of opps) {
      const page = o.page ? ` → ${o.page.replace(/^https?:\/\/[^/]+/, '')}` : '';
      body.push(`· «${o.query.slice(0, 60)}» — ${fmtNum(o.impressions)} пок., поз. ${o.position.toFixed(1)}${page}`);
    }
  }

  if (outliers.length > 0) {
    body.push('', 'Показы без кликов (страницы, правка сниппета):');
    for (const p of outliers.slice(0, 3)) {
      body.push(`· ${p.key.replace(/^https?:\/\/[^/]+/, '')} — ${fmtNum(p.impressions)} пок.`);
    }
  }

  const lines = alerts.length > 0 ? ['🚨 Тревоги:', ...alerts.map((a) => `· ${a}`), '', ...body] : body;
  return { lines, data };
}

