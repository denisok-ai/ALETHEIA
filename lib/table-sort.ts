/**
 * Сортировка строк таблицы по ключу (поле или геттер). Поддерживает string, number, date.
 */
export type SortDir = 'asc' | 'desc';

export function sortTableBy<T>(
  rows: T[],
  getValue: keyof T | ((row: T) => unknown),
  dir: SortDir
): T[] {
  const getter = typeof getValue === 'function' ? getValue : (row: T) => row[getValue];
  return [...rows].sort((a, b) => {
    const va = getter(a);
    const vb = getter(b);
    const aNull = va == null;
    const bNull = vb == null;
    if (aNull && bNull) return 0;
    if (aNull) return dir === 'asc' ? 1 : -1;
    if (bNull) return dir === 'asc' ? -1 : 1;
    let cmp: number;
    if (typeof va === 'number' && typeof vb === 'number') {
      cmp = va - vb;
    } else if (va instanceof Date && vb instanceof Date) {
      cmp = va.getTime() - vb.getTime();
    } else if (typeof va === 'string' && typeof vb === 'string' && /^\d{4}-\d{2}-\d{2}/.test(va) && /^\d{4}-\d{2}-\d{2}/.test(vb)) {
      cmp = va.localeCompare(vb);
    } else {
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      cmp = sa.localeCompare(sb, 'ru');
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}
