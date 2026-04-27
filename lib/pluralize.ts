/**
 * Склонение для русского языка.
 * one — 1, 21, 31, ... (1 сертификат)
 * few — 2–4, 22–24, ... (2 сертификата)
 * many — 0, 5–20, 25–30, ... (5 сертификатов)
 */
export function pluralize(
  n: number,
  one: string,
  few: string,
  many: string
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
