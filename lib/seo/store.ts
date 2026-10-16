/**
 * Хранилище SEO-метрик (SeoMetric) и журнал прогонов синка (SeoSyncRun).
 *
 * Коннекторы только отдают строки формата metric-types.ts; здесь — запись, чтение
 * и учёт прогонов. Цифры разных source не смешиваем: source всегда часть фильтра.
 */
import { prisma } from '@/lib/db';
import { SEO_HOST, type SeoDimension, type SeoMeasure, type SeoMetricRow, type SeoSource } from './metric-types';

/** Размер пачки upsert в одной транзакции. */
const BATCH_SIZE = 200;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Источники, по которым ведётся журнал прогонов. */
export const SEO_SOURCES: readonly SeoSource[] = ['gsc', 'metrika', 'webmaster'];

export type SeoSyncState = 'ok' | 'error' | 'not_configured';

export type SeoSyncRunInfo = {
  id: number;
  source: string;
  startedAt: Date;
  finishedAt: Date | null;
  state: string;
  rows: number;
  dateFrom: string | null;
  dateTo: string | null;
  message: string | null;
};

/**
 * Записывает строки метрик (upsert по уникальному ключу). Некорректные строки
 * (дата не YYYY-MM-DD, значение не конечное число) пропускаются, а не роняют пачку.
 * Возвращает число записанных строк.
 */
export async function upsertSeoMetrics(rows: SeoMetricRow[]): Promise<number> {
  const valid = rows.filter((r) => DATE_RE.test(r.date) && Number.isFinite(r.value));
  let written = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((r) => {
        const fields = {
          host: r.host,
          source: r.source,
          date: r.date,
          dimension: r.dimension,
          key: r.key,
          measure: r.measure,
        };
        return prisma.seoMetric.upsert({
          where: { host_source_date_dimension_key_measure: fields },
          create: { ...fields, value: r.value },
          update: { value: r.value },
        });
      }),
    );
    written += batch.length;
  }
  return written;
}

/** Строки метрик за диапазон дат (включительно), отсортированы по дате и ключу. */
export async function getSeoMetrics(filter: {
  source: SeoSource;
  dimension: SeoDimension;
  dateFrom: string;
  dateTo: string;
  measure?: SeoMeasure;
  key?: string;
  host?: string;
}): Promise<SeoMetricRow[]> {
  const rows = await prisma.seoMetric.findMany({
    where: {
      host: filter.host ?? SEO_HOST,
      source: filter.source,
      dimension: filter.dimension,
      date: { gte: filter.dateFrom, lte: filter.dateTo },
      ...(filter.measure ? { measure: filter.measure } : {}),
      ...(filter.key !== undefined ? { key: filter.key } : {}),
    },
    orderBy: [{ date: 'asc' }, { key: 'asc' }],
  });
  return rows.map((r) => ({
    host: r.host,
    source: r.source as SeoSource,
    date: r.date,
    dimension: r.dimension as SeoDimension,
    key: r.key,
    measure: r.measure as SeoMeasure,
    value: r.value,
  }));
}

/** Последняя дата, за которую есть данные по source; null, если данных нет. */
export async function latestSeoDate(source: SeoSource, host: string = SEO_HOST): Promise<string | null> {
  const row = await prisma.seoMetric.findFirst({
    where: { host, source },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  return row?.date ?? null;
}

/**
 * Открывает запись о прогоне синка; возвращает id для finishSeoSyncRun.
 * Пока прогон открыт, state = error («не завершён»): если процесс упал до finish,
 * сторож увидит ошибку, а не ложный ok.
 */
export async function startSeoSyncRun(
  source: SeoSource,
  range?: { dateFrom: string; dateTo: string },
): Promise<number> {
  const run = await prisma.seoSyncRun.create({
    data: {
      source,
      state: 'error',
      message: 'прогон не завершён',
      dateFrom: range?.dateFrom ?? null,
      dateTo: range?.dateTo ?? null,
    },
    select: { id: true },
  });
  return run.id;
}

/** Закрывает прогон: состояние, число строк и текст (ошибка или пояснение). */
export async function finishSeoSyncRun(
  id: number,
  result: { state: SeoSyncState; rows: number; message?: string | null },
): Promise<void> {
  await prisma.seoSyncRun.update({
    where: { id },
    data: {
      finishedAt: new Date(),
      state: result.state,
      rows: result.rows,
      message: result.message ?? null,
    },
  });
}

/** Прогон без finishedAt моложе этого срока считаем идущим; старше — зависшим (падение процесса). */
export const SYNC_RUN_STALE_MS = 10 * 60 * 1000;

/**
 * Есть ли прогон синка, который ещё идёт: открыт (finishedAt пуст) и начат не раньше 10 минут назад.
 * Защищает ручную кнопку от параллельного запуска; зависший прогон через 10 минут перестаёт блокировать.
 */
export async function hasRunningSeoSync(now: Date = new Date()): Promise<boolean> {
  const run = await prisma.seoSyncRun.findFirst({
    where: { finishedAt: null, startedAt: { gte: new Date(now.getTime() - SYNC_RUN_STALE_MS) } },
    select: { id: true },
  });
  return run !== null;
}

/** Последний прогон по каждому источнику (источники без прогонов не попадают в ответ). */
export async function lastSeoSyncRuns(): Promise<Record<string, SeoSyncRunInfo>> {
  const result: Record<string, SeoSyncRunInfo> = {};
  for (const source of SEO_SOURCES) {
    const run = await prisma.seoSyncRun.findFirst({
      where: { source },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    if (run) result[source] = run;
  }
  return result;
}
