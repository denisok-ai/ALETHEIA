/**
 * Окна дат SEO-отчётов: недельного дайджеста (weekly-digest.ts) и страницы админки (dashboard.ts).
 *
 * Единый источник правды: здесь же лаг GSC и граница Метрики. Чистый модуль — без prisma и сети.
 *  - GSC отдаёт данные с лагом 2 дня: неделя GSC заканчивается сегодня−2;
 *  - Метрика — до вчера включительно;
 *  - 28 дней GSC оканчиваются на ту же дату, что и неделя GSC; недельные окна режутся из этой выборки.
 */
import { addDaysIso, mskIsoDate } from '@/lib/social/moscow-day';

/** Диапазон дат YYYY-MM-DD, границы включительно. */
export type DateRange = { from: string; to: string };

export type SeoWindows = {
  /** Неделя GSC (7 дней) — последний день сегодня−2. */
  gscWeek: DateRange;
  gscPrevWeek: DateRange;
  /** 28 дней GSC — для возможностей и таблиц; недельные окна режутся из этой выборки. */
  gsc28: DateRange;
  /** Неделя Метрики (7 дней) — последний день вчера. */
  metrikaWeek: DateRange;
  metrikaPrevWeek: DateRange;
  /** Две недели Метрики одним запросом. */
  metrika14: DateRange;
};

/** Окна для момента now (по Москве). */
export function seoWindows(now: Date): SeoWindows {
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
