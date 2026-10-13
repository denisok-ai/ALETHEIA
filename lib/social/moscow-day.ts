/**
 * Календарный день по Москве (UTC+3, без перехода на летнее время с 2014 года).
 * Не зависит от часового пояса сервера и от Intl: смещение фиксированное.
 */

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Границы календарного дня (МСК), в который попадает момент now: [start, end). */
export function mskDayBounds(now: Date): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + MSK_OFFSET_MS);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - MSK_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Дата и время по Москве для вывода: «14.10.2026 10:00 МСК». */
export function formatMsk(date: Date): string {
  const s = new Date(date.getTime() + MSK_OFFSET_MS);
  return `${pad(s.getUTCDate())}.${pad(s.getUTCMonth() + 1)}.${s.getUTCFullYear()} ${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())} МСК`;
}
