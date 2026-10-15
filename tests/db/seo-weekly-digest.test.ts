/**
 * Недельный SEO-дайджест (lib/seo/weekly-digest.ts) на реальной SQLite.
 * Отправку в Telegram не проверяем: тест собирает строки, notifyAdminsTelegram подменён.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { buildSeoWeeklyDigest } from '@/lib/seo/weekly-digest';
import { upsertSeoMetrics, startSeoSyncRun, finishSeoSyncRun } from '@/lib/seo/store';
import type { SeoMetricRow } from '@/lib/seo/metric-types';

// Названия целей — сетевой вызов Метрики; в тесте его нет.
vi.mock('@/lib/seo/metrika', () => ({ fetchMetrikaGoals: vi.fn(async () => []) }));
vi.mock('@/lib/telegram-admin-notify', () => ({
  notifyAdminsTelegram: vi.fn(async () => ({ sent: 1, failed: 0, skipped: false })),
}));

/** Понедельник 14.10.2026, 09:15 МСК. */
const NOW = new Date('2026-10-14T06:15:00Z');

const row = (over: Partial<SeoMetricRow>): SeoMetricRow => ({
  host: 'avaterra.pro',
  source: 'gsc',
  date: '2026-10-08',
  dimension: 'total',
  key: '',
  measure: 'clicks',
  value: 0,
  ...over,
});

async function resetDb() {
  await prisma.seoMetric.deleteMany({});
  await prisma.seoSyncRun.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.lead.deleteMany({});
}

let orderSeq = 0;
async function paidOrder(acqRef: string | null, amount: number, paidAt: string, status = 'paid') {
  orderSeq += 1;
  await prisma.order.create({
    data: {
      orderNumber: `digest-test-${orderSeq}`,
      tariffId: 'test',
      amount,
      clientEmail: `digest${orderSeq}@example.test`,
      acqRef,
      status,
      paidAt: new Date(paidAt),
    },
  });
}

beforeEach(resetDb);

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe('buildSeoWeeklyDigest', () => {
  it('на пустой базе пишет «мало данных», предупреждения о синке и спокойную строку про Вебмастер', async () => {
    const { lines, data } = await buildSeoWeeklyDigest(NOW);
    expect(lines).toContain('GSC (поиск): показы 0, клики 0 — мало данных для выводов');
    expect(lines).toContain('⚠️ GSC: синков ещё не было');
    expect(lines).toContain('⚠️ Метрика: синков ещё не было');
    expect(lines).toContain('Вебмастер: API Яндекса недоступен, данные не собираются');
    expect(lines).toContain('Продажи за неделю: оплат нет');
    expect(lines).toContain('Метрика: визиты 0 (было 0) — мало данных для выводов');
    expect(lines.some((l) => l.startsWith('🚨'))).toBe(false);
    expect(lines.some((l) => l.includes('Вебмастер') && l.includes('⚠️'))).toBe(false);
    expect(data.alerts).toEqual([]);
  });

  it('предупреждает об ошибке синка GSC с текстом ошибки', async () => {
    const id = await startSeoSyncRun('gsc');
    await finishSeoSyncRun(id, { state: 'error', rows: 0, message: 'HTTP 403' });
    const { lines } = await buildSeoWeeklyDigest(NOW);
    expect(lines).toContain('⚠️ GSC: ошибка синка (HTTP 403)');
  });

  it('Вебмастер с прошлым успешным прогоном — обычная ошибка синка с ⚠️, а не спокойная строка', async () => {
    const ok = await startSeoSyncRun('webmaster');
    await finishSeoSyncRun(ok, { state: 'ok', rows: 5 });
    const bad = await startSeoSyncRun('webmaster');
    await finishSeoSyncRun(bad, { state: 'error', rows: 0, message: 'таймаут' });
    const { lines } = await buildSeoWeeklyDigest(NOW);
    expect(lines).toContain('⚠️ Вебмастер: ошибка синка (таймаут)');
    expect(lines.some((l) => l.startsWith('Вебмастер: API Яндекса'))).toBe(false);
  });

  it('считает продажи и заявки по каналам из acqRef; без метки и неизвестная метка — отдельно', async () => {
    await paidOrder('tg-01', 4990, '2026-10-10T12:00:00+03:00');
    await paidOrder('mx-02', 1000, '2026-10-11T12:00:00+03:00');
    await paidOrder(null, 2000, '2026-10-12T12:00:00+03:00');
    await paidOrder('zz-01', 500, '2026-10-13T12:00:00+03:00');
    // Не должны попасть: не оплачен, и оплата вне недели.
    await paidOrder('tg-01', 9999, '2026-10-10T12:00:00+03:00', 'pending');
    await paidOrder('tg-01', 9999, '2026-10-20T12:00:00+03:00');

    for (const acqRef of ['tg-01', 'tg-01', null]) {
      await prisma.lead.create({
        data: { name: 'Тест', phone: '+70000000000', acqRef, createdAt: new Date('2026-10-09T12:00:00+03:00') },
      });
    }

    const { lines, data } = await buildSeoWeeklyDigest(NOW);
    expect(lines).toContain('Продажи за неделю: 4 шт. на 8 490 ₽');
    expect(lines).toContain('· Telegram: 1 шт., 4 990 ₽');
    expect(lines).toContain('· MAX: 1 шт., 1 000 ₽');
    expect(lines).toContain('· без метки: 1 шт., 2 000 ₽');
    expect(lines).toContain('· прочее: 1 шт., 500 ₽');
    expect(data.sales.count).toBe(4);
    expect(lines).toContain('Заявки за неделю: 3 (Telegram 2 · без метки 1)');
  });

  it('при падении GSC выводит тревогу сверху, а при достаточных показах — сравнение', async () => {
    await upsertSeoMetrics([
      row({ date: '2026-09-30', measure: 'impressions', value: 60 }),
      row({ date: '2026-09-30', measure: 'clicks', value: 2 }),
      row({ date: '2026-10-08', measure: 'impressions', value: 10 }),
      row({ date: '2026-10-08', measure: 'clicks', value: 0 }),
    ]);
    const { lines } = await buildSeoWeeklyDigest(NOW);
    expect(lines[0]).toBe('🚨 Тревоги:');
    expect(lines.some((l) => l.startsWith('· GSC: показы за неделю упали'))).toBe(true);
  });

  it('сравнивает GSC с прошлой неделей, когда показов достаточно', async () => {
    await upsertSeoMetrics([
      row({ date: '2026-09-30', measure: 'impressions', value: 60 }),
      row({ date: '2026-09-30', measure: 'clicks', value: 2 }),
      row({ date: '2026-10-08', measure: 'impressions', value: 70 }),
      row({ date: '2026-10-08', measure: 'clicks', value: 3 }),
      row({ date: '2026-10-08', measure: 'position', value: 5 }),
    ]);
    const { lines } = await buildSeoWeeklyDigest(NOW);
    expect(lines).toContain('GSC (поиск): показы 70 (было 60), клики 3 (было 2), средняя позиция 5.0');
    expect(lines.some((l) => l.startsWith('🚨'))).toBe(false);
  });

  it('Вебмастер с успешным прогоном в журнале не получает спокойную строку о недоступности', async () => {
    const id = await startSeoSyncRun('webmaster');
    await finishSeoSyncRun(id, { state: 'ok', rows: 1 });
    const { lines } = await buildSeoWeeklyDigest(NOW);
    expect(lines.some((l) => l.includes('API Яндекса недоступен'))).toBe(false);
  });
});
