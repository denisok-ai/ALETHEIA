/**
 * Подготовка данных для страницы админки «SEO» (T2.5, /portal/admin/seo).
 *
 * Чистые функции над строками SeoMetricRow и журналом синков: без БД и сети, поэтому
 * тестируются без SQLite. Пороги «мало данных» передаёт страница (из weekly-digest),
 * окна дат повторяют логику недельного дайджеста (GSC — лаг 2 дня, Метрика — до вчера).
 */
import { addDaysIso, mskIsoDate } from '@/lib/social/moscow-day';
import { aggregate, ctrOutliers, opportunities, totalAgg, type Opportunity } from './analysis';
import type { SeoMetricRow, SeoSource } from './metric-types';
import type { SeoSyncRunInfo } from './store';

export type DateRange = { from: string; to: string };

export type DashboardWindows = {
  gscWeek: DateRange;
  gscPrevWeek: DateRange;
  /** 28 дней GSC, оканчиваются на gscEnd; недельные окна режутся из этой выборки. */
  gsc28: DateRange;
  metrikaWeek: DateRange;
  metrikaPrevWeek: DateRange;
  /** Метрика за две недели одним запросом. */
  metrika14: DateRange;
};

/** Окна как в недельном дайджесте: GSC отстаёт на 2 дня, Метрика — до вчера включительно. */
export function dashboardWindows(now: Date): DashboardWindows {
  const today = mskIsoDate(now);
  const gscEnd = addDaysIso(today, -2);
  const metEnd = addDaysIso(today, -1);
  const metrikaWeek = { from: addDaysIso(metEnd, -6), to: metEnd };
  const metrikaPrevWeek = { from: addDaysIso(metEnd, -13), to: addDaysIso(metEnd, -7) };
  return {
    gscWeek: { from: addDaysIso(gscEnd, -6), to: gscEnd },
    gscPrevWeek: { from: addDaysIso(gscEnd, -13), to: addDaysIso(gscEnd, -7) },
    gsc28: { from: addDaysIso(gscEnd, -27), to: gscEnd },
    metrikaWeek,
    metrikaPrevWeek,
    metrika14: { from: metrikaPrevWeek.from, to: metrikaWeek.to },
  };
}

export function inRange(rows: SeoMetricRow[], range: DateRange): SeoMetricRow[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to);
}

/** Относительное изменение в процентах; null, если база сравнения нулевая. */
export function deltaPct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** CTR = клики / показы; null, если показов не было. */
export function ctrOf(clicks: number, impressions: number): number | null {
  return impressions > 0 ? clicks / impressions : null;
}

/** URL страницы без протокола и хоста: https://avaterra.pro/kurs/ → /kurs/. */
export function relativeUrl(key: string): string {
  const path = key.replace(/^https?:\/\/[^/]+/, '');
  return path === '' ? '/' : path;
}

export type SearchCards = {
  impressions: number;
  previousImpressions: number;
  impressionsDelta: number | null;
  clicks: number;
  previousClicks: number;
  clicksDelta: number | null;
  position: number | null;
  previousPosition: number | null;
  /** Показов за неделю достаточно для выводов. */
  enough: boolean;
};

/** Карточки поиска GSC: неделя против прошлой недели (итог по сайту). */
export function buildSearchCards(totalRows: SeoMetricRow[], w: DashboardWindows, minImpressions: number): SearchCards {
  const cur = totalAgg(inRange(totalRows, w.gscWeek), 'gsc');
  const prev = totalAgg(inRange(totalRows, w.gscPrevWeek), 'gsc');
  return {
    impressions: cur.impressions,
    previousImpressions: prev.impressions,
    impressionsDelta: deltaPct(cur.impressions, prev.impressions),
    clicks: cur.clicks,
    previousClicks: prev.clicks,
    clicksDelta: deltaPct(cur.clicks, prev.clicks),
    position: cur.position,
    previousPosition: prev.position,
    enough: cur.impressions >= minImpressions,
  };
}

export type MetrikaCard = {
  visits: number;
  previousVisits: number;
  visitsDelta: number | null;
  enough: boolean;
};

/** Карточка Метрики: визиты за неделю против прошлой недели (сумма по ключам total/visits). */
export function buildMetrikaCard(totalRows: SeoMetricRow[], w: DashboardWindows, minVisits: number): MetrikaCard {
  const sumVisits = (range: DateRange): number =>
    inRange(totalRows, range)
      .filter((r) => r.source === 'metrika' && r.dimension === 'total' && r.measure === 'visits')
      .reduce((s, r) => s + r.value, 0);
  const visits = sumVisits(w.metrikaWeek);
  const previousVisits = sumVisits(w.metrikaPrevWeek);
  return {
    visits,
    previousVisits,
    visitsDelta: deltaPct(visits, previousVisits),
    enough: visits >= minVisits,
  };
}

export type QueryRow = {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
};

/** Таблица «Запросы»: топ по показам (aggregate уже сортирует по показам). */
export function buildQueryRows(queryRows: SeoMetricRow[], limit: number): QueryRow[] {
  return aggregate(queryRows, 'gsc', 'query')
    .slice(0, limit)
    .map((a) => ({
      query: a.key,
      impressions: a.impressions,
      clicks: a.clicks,
      ctr: ctrOf(a.clicks, a.impressions),
      position: a.position,
    }));
}

export type PageRow = {
  url: string;
  impressions: number;
  clicks: number;
  position: number | null;
};

/** Таблица «Страницы»: относительный URL, топ по показам. */
export function buildPageRows(pageRows: SeoMetricRow[], limit: number): PageRow[] {
  return aggregate(pageRows, 'gsc', 'page')
    .slice(0, limit)
    .map((a) => ({
      url: relativeUrl(a.key),
      impressions: a.impressions,
      clicks: a.clicks,
      position: a.position,
    }));
}

/** «Темы недели»: запросы на 6–20 месте (правило opportunities), топ по показам. */
export function buildOpportunityRows(queryRows: SeoMetricRow[], limit: number): Opportunity[] {
  return opportunities(queryRows, { minImpressions: 5 }).slice(0, limit);
}

export type CtrOutlierRow = { url: string; impressions: number };

/**
 * «Показы без кликов»: страницы с показами за неделю и без кликов. Страницы с кликами
 * за любую из двух недель исключаются (правило плана: title с кликами не меняем).
 */
export function buildCtrOutlierRows(
  pageRows: SeoMetricRow[],
  w: DashboardWindows,
  minImpressions: number,
  limit: number,
): CtrOutlierRow[] {
  const week = inRange(pageRows, w.gscWeek);
  const prev = inRange(pageRows, w.gscPrevWeek);
  const protectedKeys = new Set(
    [...week, ...prev].filter((r) => r.measure === 'clicks' && r.value > 0).map((r) => r.key),
  );
  return ctrOutliers(week, { dimension: 'page', minImpressions, protectedKeys })
    .slice(0, limit)
    .map((a) => ({ url: relativeUrl(a.key), impressions: a.impressions }));
}

export const SYNC_SOURCE_ORDER: readonly SeoSource[] = ['gsc', 'metrika', 'webmaster'];

export const SYNC_SOURCE_LABEL: Record<SeoSource, string> = {
  gsc: 'Google Search Console',
  metrika: 'Яндекс.Метрика',
  webmaster: 'Яндекс.Вебмастер',
};

export type SyncRow = {
  source: SeoSource;
  label: string;
  stateLabel: string;
  tone: 'ok' | 'warn' | 'muted';
  startedAt: Date | null;
  finishedAt: Date | null;
  rows: number | null;
  range: string | null;
  message: string | null;
  /** Спокойная пометка для Вебмастера без единого успешного прогона. */
  note: string | null;
};

export const WEBMASTER_UNAVAILABLE_NOTE = 'API Яндекса недоступен';

/** Статус синков по каждому источнику: последний прогон, состояние, строки, сообщение. */
export function buildSyncRows(runs: Record<string, SeoSyncRunInfo>, webmasterEverOk: boolean): SyncRow[] {
  return SYNC_SOURCE_ORDER.map((source) => {
    const run = runs[source];
    const base = {
      source,
      label: SYNC_SOURCE_LABEL[source],
      startedAt: run?.startedAt ?? null,
      finishedAt: run?.finishedAt ?? null,
      rows: run ? run.rows : null,
      range: run?.dateFrom && run?.dateTo ? `${run.dateFrom} … ${run.dateTo}` : null,
      message: run?.message ?? null,
    };
    if (source === 'webmaster' && !webmasterEverOk) {
      return {
        ...base,
        stateLabel: run ? 'ошибка' : 'прогонов не было',
        tone: 'muted' as const,
        note: WEBMASTER_UNAVAILABLE_NOTE,
      };
    }
    if (!run) return { ...base, stateLabel: 'прогонов не было', tone: 'muted' as const, note: null };
    if (run.state === 'ok') return { ...base, stateLabel: 'ок', tone: 'ok' as const, note: null };
    if (run.state === 'not_configured') {
      return { ...base, stateLabel: 'не настроен', tone: 'muted' as const, note: null };
    }
    return { ...base, stateLabel: 'ошибка', tone: 'warn' as const, note: null };
  });
}

/** Целое с пробелами между разрядами: 12345 → «12 345». */
export function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Процент изменения со знаком: +12 %, −5 %; null → «—». */
export function fmtDeltaPct(p: number | null): string {
  if (p === null) return '—';
  const r = Math.round(p);
  return `${r > 0 ? '+' : ''}${r} %`;
}

export function fmtPct(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)} %`;
}

export function fmtPos(p: number | null): string {
  return p === null ? '—' : p.toFixed(1);
}
