/**
 * Подготовка данных страницы SEO в админке (lib/seo/dashboard.ts). Чистые функции, без БД.
 */
import { describe, expect, it } from 'vitest';
import type { SeoDimension, SeoMeasure, SeoMetricRow, SeoSource } from '@/lib/seo/metric-types';
import type { SeoSyncRunInfo } from '@/lib/seo/store';
import {
  buildCtrOutlierRows,
  buildMetrikaCard,
  buildOpportunityRows,
  buildPageRows,
  buildQueryRows,
  buildSearchCards,
  buildSyncRows,
  dashboardWindows,
  deltaPct,
  fmtDeltaPct,
  fmtInt,
  fmtPct,
  relativeUrl,
} from '@/lib/seo/dashboard';

const r = (
  date: string,
  dimension: SeoDimension,
  key: string,
  measure: SeoMeasure,
  value: number,
  source: SeoSource = 'gsc',
): SeoMetricRow => ({ host: 'avaterra.pro', source, date, dimension, key, measure, value });

/** «Сегодня» 15.10.2026 13:00 МСК: GSC — до 13.10, Метрика — до 14.10. */
const NOW = new Date('2026-10-15T10:00:00Z');
const W = dashboardWindows(NOW);

describe('dashboardWindows', () => {
  it('повторяет окна недельного дайджеста', () => {
    expect(W.gscWeek).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    expect(W.gscPrevWeek).toEqual({ from: '2026-09-30', to: '2026-10-06' });
    expect(W.gsc28).toEqual({ from: '2026-09-16', to: '2026-10-13' });
    expect(W.metrikaWeek).toEqual({ from: '2026-10-08', to: '2026-10-14' });
    expect(W.metrikaPrevWeek).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(W.metrika14).toEqual({ from: '2026-10-01', to: '2026-10-14' });
  });
});

describe('deltaPct и форматирование', () => {
  it('изменение к прошлой неделе; при нулевой базе — null', () => {
    expect(deltaPct(150, 100)).toBe(50);
    expect(deltaPct(50, 100)).toBe(-50);
    expect(deltaPct(10, 0)).toBeNull();
    expect(fmtDeltaPct(null)).toBe('—');
    expect(fmtDeltaPct(12.4)).toBe('+12 %');
    expect(fmtDeltaPct(-5)).toBe('-5 %');
    expect(fmtPct(0.0456)).toBe('4.6 %');
    expect(fmtPct(null)).toBe('—');
    expect(fmtInt(12345)).toBe('12 345');
  });
});

describe('relativeUrl', () => {
  it('убирает протокол и хост', () => {
    expect(relativeUrl('https://avaterra.pro/kurs/')).toBe('/kurs/');
    expect(relativeUrl('https://avaterra.pro')).toBe('/');
    expect(relativeUrl('/blog/x')).toBe('/blog/x');
  });
});

describe('карточки', () => {
  it('поиск: неделя против прошлой, порог показов', () => {
    const total = [
      r('2026-10-10', 'total', '', 'impressions', 30),
      r('2026-10-10', 'total', '', 'clicks', 3),
      r('2026-10-10', 'total', '', 'position', 8),
      r('2026-10-02', 'total', '', 'impressions', 20),
      r('2026-10-02', 'total', '', 'clicks', 2),
      r('2026-10-02', 'total', '', 'position', 10),
    ];
    const c = buildSearchCards(total, W, 20);
    expect(c.impressions).toBe(30);
    expect(c.previousImpressions).toBe(20);
    expect(c.impressionsDelta).toBe(50);
    expect(c.clicks).toBe(3);
    expect(c.position).toBe(8);
    expect(c.enough).toBe(true);
  });

  it('пустые данные: нули, мало данных, без падения', () => {
    const c = buildSearchCards([], W, 20);
    expect(c.impressions).toBe(0);
    expect(c.impressionsDelta).toBeNull();
    expect(c.position).toBeNull();
    expect(c.enough).toBe(false);

    const m = buildMetrikaCard([], W, 20);
    expect(m.visits).toBe(0);
    expect(m.visitsDelta).toBeNull();
    expect(m.enough).toBe(false);
  });

  it('Метрика: суммирует визиты по неделе и помечает малую выборку', () => {
    const rows = [
      r('2026-10-09', 'total', '', 'visits', 15, 'metrika'),
      r('2026-10-10', 'total', '', 'visits', 10, 'metrika'),
      r('2026-10-03', 'total', '', 'visits', 5, 'metrika'),
      // Чужой источник не должен попасть в визиты Метрики.
      r('2026-10-09', 'total', '', 'impressions', 999),
    ];
    const m = buildMetrikaCard(rows, W, 20);
    expect(m.visits).toBe(25);
    expect(m.previousVisits).toBe(5);
    expect(m.visitsDelta).toBe(400);
    expect(m.enough).toBe(true);
    expect(buildMetrikaCard(rows, W, 100).enough).toBe(false);
  });
});

describe('таблицы', () => {
  const queries = [
    r('2026-10-01', 'query', 'кинезиология', 'impressions', 100),
    r('2026-10-01', 'query', 'кинезиология', 'clicks', 5),
    r('2026-10-01', 'query', 'кинезиология', 'position', 4),
    r('2026-10-02', 'query', 'кинезиология', 'impressions', 100),
    r('2026-10-02', 'query', 'кинезиология', 'clicks', 15),
    r('2026-10-02', 'query', 'кинезиология', 'position', 6),
    r('2026-10-01', 'query', 'курс', 'impressions', 40),
    r('2026-10-01', 'query', 'курс', 'clicks', 0),
    r('2026-10-01', 'query', 'курс', 'position', 12),
    r('2026-10-01', 'query', 'без позиции', 'impressions', 0),
    r('2026-10-01', 'query', 'без позиции', 'clicks', 0),
  ];

  it('запросы: агрегат по дням, CTR, позиция, топ по показам', () => {
    const rows = buildQueryRows(queries, 30);
    expect(rows.map((x) => x.query)).toEqual(['кинезиология', 'курс', 'без позиции']);
    const top = rows[0];
    expect(top.impressions).toBe(200);
    expect(top.clicks).toBe(20);
    expect(top.ctr).toBeCloseTo(0.1);
    // Позиция взвешена по показам: (4·100 + 6·100) / 200 = 5.
    expect(top.position).toBe(5);
    expect(rows[2].ctr).toBeNull();
    expect(rows[2].position).toBeNull();
    expect(buildQueryRows(queries, 1)).toHaveLength(1);
  });

  it('страницы: относительный URL', () => {
    const pages = [
      r('2026-10-01', 'page', 'https://avaterra.pro/kurs/', 'impressions', 50),
      r('2026-10-01', 'page', 'https://avaterra.pro/kurs/', 'clicks', 2),
      r('2026-10-01', 'page', 'https://avaterra.pro/kurs/', 'position', 3),
    ];
    const rows = buildPageRows(pages, 20);
    expect(rows).toEqual([{ url: '/kurs/', impressions: 50, clicks: 2, position: 3 }]);
  });

  it('темы недели: запросы на 6–20 месте', () => {
    const rows = [
      r('2026-10-01', 'query', 'в топе', 'impressions', 80),
      r('2026-10-01', 'query', 'в топе', 'position', 2),
      r('2026-10-01', 'query', 'тема', 'impressions', 30),
      r('2026-10-01', 'query', 'тема', 'position', 9),
    ];
    const opp = buildOpportunityRows(rows, 20);
    expect(opp.map((o) => o.query)).toEqual(['тема']);
    expect(buildOpportunityRows([], 20)).toEqual([]);
  });

  it('показы без кликов: страницы с кликами за любую неделю исключаются', () => {
    const pages = [
      r('2026-10-10', 'page', 'https://avaterra.pro/a/', 'impressions', 40),
      r('2026-10-10', 'page', 'https://avaterra.pro/a/', 'clicks', 0),
      r('2026-10-10', 'page', 'https://avaterra.pro/b/', 'impressions', 40),
      r('2026-10-10', 'page', 'https://avaterra.pro/b/', 'clicks', 0),
      // /b/ кликали на прошлой неделе — трогать нельзя.
      r('2026-10-02', 'page', 'https://avaterra.pro/b/', 'clicks', 1),
      r('2026-10-10', 'page', 'https://avaterra.pro/c/', 'impressions', 5),
    ];
    expect(buildCtrOutlierRows(pages, W, 20, 20)).toEqual([{ url: '/a/', impressions: 40 }]);
  });
});

describe('статус синков', () => {
  const run = (over: Partial<SeoSyncRunInfo>): SeoSyncRunInfo => ({
    id: 1,
    source: 'gsc',
    startedAt: new Date('2026-10-15T00:30:00Z'),
    finishedAt: new Date('2026-10-15T00:31:00Z'),
    state: 'ok',
    rows: 42,
    dateFrom: '2026-10-08',
    dateTo: '2026-10-13',
    message: null,
    ...over,
  });

  it('пустой журнал: все источники «прогонов не было»; Вебмастер — спокойная пометка', () => {
    const rows = buildSyncRows({}, false);
    expect(rows.map((x) => x.source)).toEqual(['gsc', 'metrika', 'webmaster']);
    expect(rows.every((x) => x.stateLabel === 'прогонов не было')).toBe(true);
    expect(rows[2].note).toBe('API Яндекса недоступен');
    expect(rows[2].tone).toBe('muted');
    expect(rows[0].note).toBeNull();
  });

  it('ok, ошибка и «не настроен» с сообщением и строками', () => {
    const rows = buildSyncRows(
      {
        gsc: run({}),
        metrika: run({ source: 'metrika', state: 'error', rows: 0, message: 'таймаут' }),
        webmaster: run({ source: 'webmaster', state: 'not_configured', rows: 0 }),
      },
      true,
    );
    expect(rows[0]).toMatchObject({ stateLabel: 'ок', tone: 'ok', rows: 42, range: '2026-10-08 … 2026-10-13' });
    expect(rows[1]).toMatchObject({ stateLabel: 'ошибка', tone: 'warn', message: 'таймаут' });
    expect(rows[2]).toMatchObject({ stateLabel: 'не настроен', tone: 'muted', note: null });
  });
});
