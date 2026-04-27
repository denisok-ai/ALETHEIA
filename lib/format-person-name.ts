/**
 * Форматирование имён для отображения.
 * В русской традиции: «Имя Фамилия». Если данные сохранены как «Фамилия Имя» — переставляем.
 */
const SURNAME_SUFFIXES = /(ов|ев|ин|ова|ева|ина|ий|ая|ой|ый)$/i;

/** Слова, которые явно указывают на имя (первое слово) при ошибочном порядке «Фамилия Имя». */
const FIRST_NAME_INDICATORS = new Set(['Имя', 'Имярек']);

/**
 * Возвращает имя в формате «Имя Фамилия» для отображения.
 * Эвристика: если первое слово — фамилия (суффиксы -ов/-ева) или второе — явное «Имя» — переставляем.
 */
export function formatPersonName(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  const s = name.trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return s;
  const [first, second] = parts;
  if (!first || !second) return s;
  const shouldSwap =
    (SURNAME_SUFFIXES.test(first) && !SURNAME_SUFFIXES.test(second)) ||
    FIRST_NAME_INDICATORS.has(second);
  if (shouldSwap) return `${second} ${first}`;
  return s;
}
