/**
 * Хранилище SEO-метрик (lib/seo/store.ts) на реальной SQLite.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  finishSeoSyncRun,
  getSeoMetrics,
  hasRunningSeoSync,
  latestSeoDate,
  lastSeoSyncRuns,
  startSeoSyncRun,
  upsertSeoMetrics,
} from '@/lib/seo/store';
import type { SeoMetricRow } from '@/lib/seo/metric-types';

async function resetDb() {
  await prisma.seoMetric.deleteMany({});
  await prisma.seoSyncRun.deleteMany({});
}

const row = (over: Partial<SeoMetricRow> = {}): SeoMetricRow => ({
  host: 'avaterra.pro',
  source: 'gsc',
  date: '2026-10-10',
  dimension: 'total',
  key: '',
  measure: 'clicks',
  value: 5,
  ...over,
});

beforeEach(resetDb);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('upsertSeoMetrics', () => {
  it('обновляет строку с тем же ключом, а не дублирует её', async () => {
    expect(await upsertSeoMetrics([row({ measure: 'clicks', value: 5 }), row({ measure: 'impressions', value: 100 })])).toBe(2);
    expect(await upsertSeoMetrics([row({ measure: 'clicks', value: 7 })])).toBe(1);

    const all = await prisma.seoMetric.findMany({ orderBy: { measure: 'asc' } });
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.measure === 'clicks')?.value).toBe(7);
  });

  it('пропускает строки с плохой датой и не конечным значением', async () => {
    const written = await upsertSeoMetrics([
      row({ date: '2026-10-11' }),
      row({ date: '11.10.2026' }),
      row({ date: '2026-10-12', value: Number.NaN }),
      row({ date: '2026-10-13', value: Number.POSITIVE_INFINITY }),
    ]);
    expect(written).toBe(1);
    expect(await prisma.seoMetric.count()).toBe(1);
  });

  it('пишет пачками больше 200 строк', async () => {
    const rows = Array.from({ length: 450 }, (_, i) => row({ key: `q${i}`, dimension: 'query', measure: 'clicks' }));
    expect(await upsertSeoMetrics(rows)).toBe(450);
    expect(await prisma.seoMetric.count()).toBe(450);
  });
});

describe('getSeoMetrics', () => {
  beforeEach(async () => {
    await upsertSeoMetrics([
      row({ date: '2026-10-01', measure: 'clicks', value: 1 }),
      row({ date: '2026-10-02', measure: 'clicks', value: 2 }),
      row({ date: '2026-10-02', measure: 'impressions', value: 20 }),
      row({ date: '2026-10-05', measure: 'clicks', value: 5 }),
      row({ date: '2026-10-02', measure: 'clicks', value: 9, source: 'metrika' }),
    ]);
  });

  it('фильтрует по диапазону дат и source', async () => {
    const rows = await getSeoMetrics({ source: 'gsc', dimension: 'total', dateFrom: '2026-10-02', dateTo: '2026-10-05' });
    expect(rows.map((r) => `${r.date}:${r.measure}`)).toEqual([
      '2026-10-02:clicks',
      '2026-10-02:impressions',
      '2026-10-05:clicks',
    ]);
  });

  it('фильтрует по measure', async () => {
    const rows = await getSeoMetrics({
      source: 'gsc',
      dimension: 'total',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      measure: 'clicks',
    });
    expect(rows.every((r) => r.measure === 'clicks')).toBe(true);
    expect(rows.map((r) => r.value)).toEqual([1, 2, 5]);
  });
});

describe('latestSeoDate', () => {
  it('возвращает последнюю дату по source или null', async () => {
    expect(await latestSeoDate('gsc')).toBeNull();
    await upsertSeoMetrics([row({ date: '2026-10-03' }), row({ date: '2026-10-09' }), row({ date: '2026-10-20', source: 'metrika' })]);
    expect(await latestSeoDate('gsc')).toBe('2026-10-09');
    expect(await latestSeoDate('metrika')).toBe('2026-10-20');
  });
});

describe('журнал прогонов', () => {
  it('открывает и закрывает прогон, lastSeoSyncRuns отдаёт последний по source', async () => {
    const first = await startSeoSyncRun('gsc', { dateFrom: '2026-10-01', dateTo: '2026-10-05' });
    await finishSeoSyncRun(first, { state: 'error', rows: 0, message: 'таймаут' });
    const second = await startSeoSyncRun('gsc', { dateFrom: '2026-10-06', dateTo: '2026-10-10' });
    await finishSeoSyncRun(second, { state: 'ok', rows: 42 });
    await finishSeoSyncRun(await startSeoSyncRun('webmaster'), { state: 'not_configured', rows: 0, message: 'нет токена' });

    const runs = await lastSeoSyncRuns();
    expect(runs.gsc).toMatchObject({ id: second, state: 'ok', rows: 42, dateFrom: '2026-10-06', dateTo: '2026-10-10', message: null });
    expect(runs.gsc.finishedAt).toBeInstanceOf(Date);
    expect(runs.webmaster).toMatchObject({ state: 'not_configured', message: 'нет токена' });
    expect(runs.metrika).toBeUndefined();
  });

  it('hasRunningSeoSync: открытый прогон моложе 10 минут блокирует; закрытый или зависший — нет', async () => {
    const now = new Date();
    expect(await hasRunningSeoSync(now)).toBe(false);

    const id = await startSeoSyncRun('gsc');
    expect(await hasRunningSeoSync(now)).toBe(true);
    await finishSeoSyncRun(id, { state: 'ok', rows: 1 });
    expect(await hasRunningSeoSync(now)).toBe(false);

    // Открытый прогон, которому больше 10 минут: процесс упал до finish — не блокируем навсегда.
    await startSeoSyncRun('metrika');
    expect(await hasRunningSeoSync(new Date(now.getTime() + 11 * 60 * 1000))).toBe(false);
  });
});
