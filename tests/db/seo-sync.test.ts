/**
 * Ночной синк SEO-метрик (lib/seo/sync.ts) на реальной SQLite.
 * Коннекторы и Telegram подменены: сеть не трогаем, в Telegram ничего не уходит.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { fetchGscDaily } from '@/lib/seo/gsc';
import { fetchMetrikaDaily } from '@/lib/seo/metrika';
import { fetchWebmasterDaily } from '@/lib/seo/webmaster-metrics';
import { runSeoSync } from '@/lib/seo/sync';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import type { SeoMetricRow } from '@/lib/seo/metric-types';

vi.mock('@/lib/seo/gsc', () => ({ fetchGscDaily: vi.fn() }));
vi.mock('@/lib/seo/metrika', () => ({ fetchMetrikaDaily: vi.fn() }));
vi.mock('@/lib/seo/webmaster-metrics', () => ({ fetchWebmasterDaily: vi.fn() }));
vi.mock('@/lib/telegram-admin-notify', () => ({ notifyAdminsTelegram: vi.fn() }));

/** 15.10.2026 10:00 UTC = 13:00 МСК: «сегодня» по Москве — 15 октября. */
const NOW = new Date('2026-10-15T10:00:00Z');

const OK = { status: { state: 'ok' as const } };

const row = (source: SeoMetricRow['source'], date: string): SeoMetricRow => ({
  host: 'avaterra.pro',
  source,
  date,
  dimension: 'total',
  key: '',
  measure: 'clicks',
  value: 1,
});

async function resetDb() {
  await prisma.seoMetric.deleteMany({});
  await prisma.seoSyncRun.deleteMany({});
}

/** Коннекторы отвечают успешно (с одной строкой), если не переопределено. */
function connectorsOk() {
  vi.mocked(fetchGscDaily).mockResolvedValue({ ...OK, rows: [row('gsc', '2026-10-13')] });
  vi.mocked(fetchMetrikaDaily).mockResolvedValue({ ...OK, rows: [row('metrika', '2026-10-14')] });
  vi.mocked(fetchWebmasterDaily).mockResolvedValue({ ...OK, rows: [row('webmaster', '2026-10-14')] });
}

/** Чтобы первый запуск не превратился в бэкфилл: во всех источниках уже есть данные. */
async function seedHistory() {
  await prisma.seoMetric.createMany({
    data: [
      { host: 'avaterra.pro', source: 'gsc', date: '2026-10-01', dimension: 'total', key: '', measure: 'clicks', value: 1 },
      { host: 'avaterra.pro', source: 'metrika', date: '2026-10-01', dimension: 'total', key: '', measure: 'visits', value: 1 },
      { host: 'avaterra.pro', source: 'webmaster', date: '2026-10-01', dimension: 'indexing', key: 'http_2xx', measure: 'pages', value: 1 },
    ],
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
  connectorsOk();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('окна дат', () => {
  it('для уже заполненных источников — штатные окна от «сегодня» по МСК', async () => {
    await seedHistory();
    await runSeoSync({ now: NOW });

    expect(fetchGscDaily).toHaveBeenCalledWith({ dateFrom: '2026-10-10', dateTo: '2026-10-13' });
    expect(fetchMetrikaDaily).toHaveBeenCalledWith({ dateFrom: '2026-10-13', dateTo: '2026-10-14' });
    expect(fetchWebmasterDaily).toHaveBeenCalledWith({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });
  });

  it('пустая база → бэкфилл 90 дней, заканчивающийся на штатной дате конца', async () => {
    await runSeoSync({ now: NOW });

    // 90 дней включительно до штатного конца окна источника
    expect(fetchGscDaily).toHaveBeenCalledWith({ dateFrom: '2026-07-16', dateTo: '2026-10-13' });
    expect(fetchMetrikaDaily).toHaveBeenCalledWith({ dateFrom: '2026-07-17', dateTo: '2026-10-14' });
  });

  it('days переопределяет окно (ручной дозабор)', async () => {
    await seedHistory();
    await runSeoSync({ now: NOW, days: 7 });

    expect(fetchGscDaily).toHaveBeenCalledWith({ dateFrom: '2026-10-07', dateTo: '2026-10-13' });
    expect(fetchWebmasterDaily).toHaveBeenCalledWith({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });
  });
});

describe('запись и журнал', () => {
  it('пишет строки источников и открывает/закрывает прогон', async () => {
    await seedHistory();
    const report = await runSeoSync({ now: NOW });

    expect(report.sources.gsc.state).toBe('ok');
    expect(report.sources.gsc.rows).toBe(1);
    expect(await prisma.seoMetric.count({ where: { source: 'webmaster', date: '2026-10-14' } })).toBe(1);

    const runs = await prisma.seoSyncRun.findMany({ orderBy: { id: 'asc' } });
    expect(runs.map((r) => `${r.source}:${r.state}`)).toEqual(
      expect.arrayContaining(['gsc:ok', 'metrika:ok', 'webmaster:ok']),
    );
    expect(runs.find((r) => r.source === 'gsc')?.finishedAt).not.toBeNull();
  });

  it('ошибка одного источника не мешает остальным', async () => {
    await seedHistory();
    vi.mocked(fetchGscDaily).mockRejectedValue(new Error('взрыв'));
    vi.mocked(fetchMetrikaDaily).mockResolvedValue({ status: { state: 'error', reason: 'Метрика: HTTP 500' }, rows: [] });

    const report = await runSeoSync({ now: NOW });

    expect(report.sources.gsc.state).toBe('error');
    expect(report.sources.metrika.state).toBe('error');
    expect(report.sources.metrika.message).toBe('Метрика: HTTP 500');
    expect(report.sources.webmaster.state).toBe('ok');
    expect(await prisma.seoMetric.count({ where: { source: 'webmaster', date: '2026-10-14' } })).toBe(1);
  });

  it('not_configured записывается как not_configured и без алерта', async () => {
    await seedHistory();
    vi.mocked(fetchWebmasterDaily).mockResolvedValue({ status: { state: 'not_configured', reason: 'нет токена' }, rows: [] });
    for (let i = 0; i < 3; i++) await runSeoSync({ now: NOW });

    expect(notifyAdminsTelegram).not.toHaveBeenCalled();
    const last = await prisma.seoSyncRun.findFirst({ where: { source: 'webmaster' }, orderBy: { id: 'desc' } });
    expect(last?.state).toBe('not_configured');
  });

  it('dryRun ничего не пишет: ни метрик, ни журнала, ни алертов', async () => {
    await seedHistory();
    vi.mocked(fetchGscDaily).mockResolvedValue({ status: { state: 'error', reason: 'x' }, rows: [] });
    await runSeoSync({ now: NOW, dryRun: true });
    await runSeoSync({ now: NOW, dryRun: true });

    expect(fetchGscDaily).toHaveBeenCalled();
    expect(await prisma.seoMetric.count({ where: { source: 'webmaster' } })).toBe(1);
    expect(await prisma.seoSyncRun.count()).toBe(0);
    expect(notifyAdminsTelegram).not.toHaveBeenCalled();
  });
});

describe('алерт владельцу', () => {
  it('только на второй ошибке подряд, если до этого источник был ok', async () => {
    await seedHistory();
    // Предыстория: один успешный прогон GSC.
    await prisma.seoSyncRun.create({ data: { source: 'gsc', state: 'ok', rows: 5, finishedAt: new Date() } });
    vi.mocked(fetchGscDaily).mockResolvedValue({ status: { state: 'error', reason: 'Search Console вернул HTTP 503' }, rows: [] });

    // Первая ошибка после ok — разовый сбой, молчим.
    await runSeoSync({ now: NOW });
    expect(notifyAdminsTelegram).not.toHaveBeenCalled();

    // Вторая подряд — алерт.
    await runSeoSync({ now: NOW });
    expect(notifyAdminsTelegram).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notifyAdminsTelegram).mock.calls[0][0]).toBe('seo_sync');

    // Третья подряд — не спамим повторно.
    await runSeoSync({ now: NOW });
    expect(notifyAdminsTelegram).toHaveBeenCalledTimes(1);
  });

  it('источник, который никогда не был ok, не алертит даже при сбоях', async () => {
    await seedHistory();
    vi.mocked(fetchMetrikaDaily).mockResolvedValue({ status: { state: 'error', reason: 'x' }, rows: [] });
    await runSeoSync({ now: NOW });
    await runSeoSync({ now: NOW });
    await runSeoSync({ now: NOW });
    expect(notifyAdminsTelegram).not.toHaveBeenCalled();
  });
});
