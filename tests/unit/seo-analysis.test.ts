/**
 * Анализ SEO-метрик (lib/seo/analysis.ts): корзины, регрессии, CTR-выбросы,
 * возможности и сторож. Чистые функции — без БД.
 */
import { describe, expect, it } from 'vitest';
import type { SeoDimension, SeoMetricRow, SeoMeasure, SeoSource } from '@/lib/seo/metric-types';
import {
  ctrOutliers,
  opportunities,
  positionBuckets,
  queryPageKey,
  queryPagePairs,
  regressions,
  seoWatchdog,
  splitQueryPageKey,
} from '@/lib/seo/analysis';

const r = (
  date: string,
  dimension: SeoDimension,
  key: string,
  measure: SeoMeasure,
  value: number,
  source: SeoSource = 'gsc',
): SeoMetricRow => ({ host: 'avaterra.pro', source, date, dimension, key, measure, value });

/** Строка запроса за день: показы, клики и позиция. */
const q = (date: string, key: string, impressions: number, position: number, clicks = 0): SeoMetricRow[] => [
  r(date, 'query', key, 'impressions', impressions),
  r(date, 'query', key, 'clicks', clicks),
  r(date, 'query', key, 'position', position),
];

describe('positionBuckets', () => {
  it('усредняет позицию по показам, а не по дням', () => {
    // Два дня: 90 показов на позиции 2 и 10 показов на позиции 22 → средняя ≈ 3.2 → корзина 4–10 по округлению.
    const rows = [...q('2026-10-01', 'тест', 90, 2), ...q('2026-10-02', 'тест', 10, 22)];
    const { buckets } = positionBuckets(rows);
    expect(buckets['4–10']).toEqual({ queries: 1, impressions: 100 });
    expect(buckets['1–3']).toEqual({ queries: 0, impressions: 0 });
  });

  it('раскладывает запросы по четырём корзинам и считает запросы без позиции отдельно', () => {
    const rows = [
      ...q('2026-10-01', 'а', 10, 1.2),
      ...q('2026-10-01', 'б', 20, 7),
      ...q('2026-10-01', 'в', 5, 15),
      ...q('2026-10-01', 'г', 3, 40),
      [r('2026-10-01', 'query', 'нет позиции', 'impressions', 0)][0],
    ];
    const res = positionBuckets(rows);
    expect(res.buckets['1–3'].queries).toBe(1);
    expect(res.buckets['4–10'].queries).toBe(1);
    expect(res.buckets['11–20'].queries).toBe(1);
    expect(res.buckets['21+'].queries).toBe(1);
    expect(res.withoutPosition).toBe(1);
  });

  it('игнорирует страницы и другие источники', () => {
    const rows = [...q('2026-10-01', 'а', 10, 2), r('2026-10-01', 'page', '/x', 'impressions', 999), r('2026-10-01', 'page', '/x', 'position', 30)];
    expect(positionBuckets(rows).buckets['1–3'].impressions).toBe(10);
  });
});

describe('regressions', () => {
  it('срабатывает при падении показов ≥ 50 % и ухудшении позиции ≥ 3', () => {
    const prev = q('2026-10-01', 'тело знает', 40, 4, 3);
    const cur = q('2026-10-08', 'тело знает', 10, 9, 0);
    const res = regressions(cur, prev);
    expect(res).toHaveLength(1);
    expect(res[0].key).toBe('тело знает');
    expect(res[0].reasons).toEqual(expect.arrayContaining(['clicks', 'impressions']));
    expect(res[0].positionDelta).toBeCloseTo(5, 5);
  });

  it('не срабатывает ниже порога показов прошлой недели', () => {
    const prev = q('2026-10-01', 'мало', 19, 4, 2);
    const cur = q('2026-10-08', 'мало', 0, 15);
    expect(regressions(cur, prev)).toEqual([]);
  });

  it('не срабатывает, если позиция ухудшилась меньше чем на 3', () => {
    const prev = q('2026-10-01', 'стабильно', 50, 4, 5);
    const cur = q('2026-10-08', 'стабильно', 10, 5.5, 1);
    expect(regressions(cur, prev)).toEqual([]);
  });
});

describe('ctrOutliers', () => {
  it('показы от порога и ноль кликов — кандидаты; страницы с кликами и защищённые исключаются', () => {
    const rows = [
      r('2026-10-01', 'page', '/a', 'impressions', 30),
      r('2026-10-01', 'page', '/a', 'clicks', 0),
      r('2026-10-01', 'page', '/b', 'impressions', 40),
      r('2026-10-01', 'page', '/b', 'clicks', 2),
      r('2026-10-01', 'page', '/c', 'impressions', 10),
      r('2026-10-01', 'page', '/c', 'clicks', 0),
      r('2026-10-01', 'page', '/d', 'impressions', 25),
      r('2026-10-01', 'page', '/d', 'clicks', 0),
    ];
    expect(ctrOutliers(rows, { dimension: 'page' }).map((a) => a.key)).toEqual(['/a', '/d']);
    expect(ctrOutliers(rows, { dimension: 'page', protectedKeys: new Set(['/d']) }).map((a) => a.key)).toEqual(['/a']);
  });
});

describe('opportunities', () => {
  it('берёт запросы с показами ≥ 5 на средней позиции 6–20 и сортирует по показам', () => {
    const rows = [
      ...q('2026-10-01', 'в топ-5', 50, 3),
      ...q('2026-10-01', 'шестое', 8, 6.4),
      ...q('2026-10-02', 'двадцатое', 12, 20),
      ...q('2026-10-01', 'за двадцатым', 30, 21),
      ...q('2026-10-01', 'мало показов', 4, 9),
    ];
    const res = opportunities(rows);
    expect(res.map((o) => o.query)).toEqual(['двадцатое', 'шестое']);
    expect(res[0].page).toBeNull();
  });

  it('привязывает страницу с максимальными показами по паре запрос–страница', () => {
    const rows = q('2026-10-01', 'глоссарий', 12, 8);
    const res = opportunities(rows, {
      pairs: [
        { query: 'глоссарий', page: '/glossary', impressions: 9 },
        { query: 'глоссарий', page: '/blog/x', impressions: 3 },
      ],
    });
    expect(res[0].page).toBe('/glossary');
  });
});

describe('seoWatchdog', () => {
  const week = (date: string, impressions: number, clicks: number) => [
    r(date, 'total', '', 'impressions', impressions),
    r(date, 'total', '', 'clicks', clicks),
  ];

  it('молчит на малых данных', () => {
    expect(seoWatchdog(week('2026-10-08', 0, 0), week('2026-10-01', 40, 2))).toEqual([]);
    expect(seoWatchdog(week('2026-10-08', 5, 0), week('2026-10-01', 49, 3))).toEqual([]);
  });

  it('срабатывает на падении показов и кликов ≥ 50 % при показах прошлой недели ≥ 50', () => {
    const alerts = seoWatchdog(week('2026-10-08', 20, 0), week('2026-10-01', 60, 4));
    expect(alerts).toHaveLength(2);
    expect(alerts.some((a) => a.includes('показы'))).toBe(true);
    expect(alerts.some((a) => a.includes('клики'))).toBe(true);
  });

  it('молчит, если за текущую неделю вообще нет GSC-данных (это проблема синка)', () => {
    expect(seoWatchdog([], week('2026-10-01', 60, 4))).toEqual([]);
  });

  it('срабатывает на падении индексации Вебмастера ≥ 20 %', () => {
    const idx = (date: string, value: number) => r(date, 'indexing', 'searchable', 'pages', value, 'webmaster');
    expect(seoWatchdog([idx('2026-10-08', 70)], [idx('2026-10-01', 100)])).toEqual([
      'Яндекс: страниц в поиске стало 70 (было 100)',
    ]);
    expect(seoWatchdog([idx('2026-10-08', 85)], [idx('2026-10-01', 100)])).toEqual([]);
  });
});

describe('queryPageKey / splitQueryPageKey', () => {
  it('склеивает запрос и страницу табуляцией и разбирает обратно', () => {
    const key = queryPageKey('на автопилоте это', 'https://avaterra.pro/glossary/avtopilot');
    expect(key).toBe('на автопилоте это\thttps://avaterra.pro/glossary/avtopilot');
    expect(splitQueryPageKey(key)).toEqual({ query: 'на автопилоте это', page: 'https://avaterra.pro/glossary/avtopilot' });
  });

  it('ключ без табуляции не разбирается (строка не из query_page)', () => {
    expect(splitQueryPageKey('кинезиология')).toBeNull();
  });
});

describe('queryPagePairs', () => {
  it('суммирует показы пары по дням и отбрасывает ключи без страницы', () => {
    const k = queryPageKey('глоссарий', '/glossary');
    const rows: SeoMetricRow[] = [
      r('2026-10-01', 'query_page', k, 'impressions', 4),
      r('2026-10-02', 'query_page', k, 'impressions', 6),
      r('2026-10-02', 'query_page', queryPageKey('без страницы', ''), 'impressions', 3),
      r('2026-10-02', 'query_page', k, 'clicks', 9),
    ];
    expect(queryPagePairs(rows)).toEqual([{ query: 'глоссарий', page: '/glossary', impressions: 10 }]);
  });
});
