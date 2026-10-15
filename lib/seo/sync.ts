/**
 * Ночной синк SEO-метрик: GSC, Метрика и Вебмастер → таблица SeoMetric.
 *
 * Оркестрация: окно дат по каждому источнику → коннектор → upsert → запись в SeoSyncRun.
 * Сбой одного источника не мешает другим. Алерт в Telegram — только когда источник,
 * который был ok, второй прогон подряд в error (разовый сбой не шумит).
 * dryRun: коннекторы вызываются, но ничего не пишется (ни метрики, ни журнал).
 */
import { prisma } from '@/lib/db';
import { addDaysIso, mskIsoDate } from '@/lib/social/moscow-day';
import { notifyAdminsTelegram } from '@/lib/telegram-admin-notify';
import { fetchGscDaily } from './gsc';
import { fetchMetrikaDaily } from './metrika';
import type { SeoConnectorStatus, SeoMetricRow, SeoSource } from './metric-types';
import { finishSeoSyncRun, latestSeoDate, startSeoSyncRun, upsertSeoMetrics, type SeoSyncState } from './store';
import { fetchWebmasterDaily } from './webmaster-metrics';

/** Окно первого запуска (пустая база): сколько дней догоняем. */
const BACKFILL_DAYS = 90;

/**
 * Окна относительно «сегодня» по МСК: сдвиги в днях.
 * GSC отдаёт данные с запаздыванием 2–3 дня, финальные цифры меняются ещё ~3 дня —
 * поэтому окно GSC — сегодня−5 … сегодня−2 (перезапись). Метрика — вчера и позавчера.
 */
const WINDOW_OFFSETS: Record<SeoSource, { from: number; to: number }> = {
  gsc: { from: -5, to: -2 },
  metrika: { from: -2, to: -1 },
  webmaster: { from: -7, to: -1 },
};

const SOURCE_LABEL: Record<SeoSource, string> = {
  gsc: 'Google Search Console',
  metrika: 'Яндекс.Метрика',
  webmaster: 'Яндекс.Вебмастер',
};

type Fetcher = (win: { dateFrom: string; dateTo: string }) => Promise<{ status: SeoConnectorStatus; rows: SeoMetricRow[] }>;

const FETCHERS: Record<SeoSource, Fetcher> = {
  gsc: (w) => fetchGscDaily(w),
  metrika: (w) => fetchMetrikaDaily(w),
  webmaster: (w) => fetchWebmasterDaily(w),
};

export type SeoSyncSourceReport = {
  state: SeoSyncState;
  rows: number;
  dateFrom: string;
  dateTo: string;
  message?: string;
};

export type SeoSyncReport = { sources: Record<SeoSource, SeoSyncSourceReport> };

/** Окно дат источника. days — ручной дозабор от dateTo назад; первый запуск — бэкфилл. */
async function windowFor(
  source: SeoSource,
  today: string,
  days: number | undefined,
): Promise<{ dateFrom: string; dateTo: string }> {
  const offsets = WINDOW_OFFSETS[source];
  const dateTo = addDaysIso(today, offsets.to);
  if (days !== undefined) return { dateFrom: addDaysIso(dateTo, -(days - 1)), dateTo };
  if ((await latestSeoDate(source)) === null) {
    return { dateFrom: addDaysIso(dateTo, -(BACKFILL_DAYS - 1)), dateTo };
  }
  return { dateFrom: addDaysIso(today, offsets.from), dateTo };
}

/** Два последних прогона с ошибкой подряд, а перед ними был ok — тогда и только тогда алерт. */
async function isSecondErrorAfterOk(source: SeoSource): Promise<boolean> {
  const runs = await prisma.seoSyncRun.findMany({
    where: { source },
    orderBy: { id: 'desc' },
    take: 3,
    select: { state: true },
  });
  if (runs.length < 3) return false;
  const [current, previous, beforePrevious] = runs;
  return current.state === 'error' && previous.state === 'error' && beforePrevious.state === 'ok';
}

/** Синк одного источника. Никогда не бросает наружу: любой сбой — state error в отчёте. */
async function syncSource(
  source: SeoSource,
  today: string,
  opts: { days?: number; dryRun: boolean },
): Promise<SeoSyncSourceReport> {
  let win = { dateFrom: '', dateTo: '' };
  let runId: number | null = null;
  let result: { state: SeoSyncState; rows: number; message?: string };
  try {
    win = await windowFor(source, today, opts.days);
    if (!opts.dryRun) runId = await startSeoSyncRun(source, win);
    const { status, rows } = await FETCHERS[source](win);
    if (status.state === 'ok' && !opts.dryRun) await upsertSeoMetrics(rows);
    result = {
      state: status.state,
      rows: rows.length,
      message: status.state === 'ok' ? undefined : status.reason,
    };
  } catch (e) {
    result = {
      state: 'error',
      rows: 0,
      message: `сбой синка: ${e instanceof Error ? e.name : 'неизвестная ошибка'}`,
    };
  }

  if (!opts.dryRun) {
    try {
      if (runId !== null) await finishSeoSyncRun(runId, result);
      if (result.state === 'error' && (await isSecondErrorAfterOk(source))) {
        await notifyAdminsTelegram('seo_sync', [
          `Источник: ${SOURCE_LABEL[source]}`,
          'Второй прогон подряд завершился ошибкой; до этого данные синхронизировались.',
          `Причина: ${result.message ?? 'не указана'}`,
          'Остальные источники продолжают работать. Журнал прогонов — таблица SeoSyncRun.',
        ]);
      }
    } catch (e) {
      console.error(`[seo-sync] ${source}: журнал или алерт не записан:`, e instanceof Error ? e.name : e);
    }
  }

  return { ...result, dateFrom: win.dateFrom, dateTo: win.dateTo };
}

/**
 * Прогон синка по всем источникам (последовательно: квоты API не делим параллельно).
 * now — для тестов; days — ручной дозабор; dryRun — без записи в БД.
 */
export async function runSeoSync(opts: { now?: Date; days?: number; dryRun?: boolean } = {}): Promise<SeoSyncReport> {
  const today = mskIsoDate(opts.now ?? new Date());
  const common = { days: opts.days, dryRun: opts.dryRun ?? false };
  const sources: Record<SeoSource, SeoSyncSourceReport> = {
    gsc: await syncSource('gsc', today, common),
    metrika: await syncSource('metrika', today, common),
    webmaster: await syncSource('webmaster', today, common),
  };
  return { sources };
}
