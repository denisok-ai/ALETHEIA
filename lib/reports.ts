/**
 * Вспомогательные функции для отчётов: парсинг периода, формирование CSV.
 */
export function parseReportPeriod(searchParams: URLSearchParams): { dateFrom: Date; dateTo: Date } {
  const now = new Date();
  const defaultTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setDate(defaultFrom.getDate() - 30);

  const fromStr = searchParams.get('dateFrom')?.trim();
  const toStr = searchParams.get('dateTo')?.trim();

  const dateFrom = fromStr ? new Date(fromStr) : defaultFrom;
  const dateTo = toStr ? new Date(toStr) : defaultTo;

  if (Number.isNaN(dateFrom.getTime())) dateFrom.setTime(defaultFrom.getTime());
  if (Number.isNaN(dateTo.getTime())) dateTo.setTime(defaultTo.getTime());

  if (dateFrom > dateTo) {
    const swap = dateFrom;
    return { dateFrom: dateTo, dateTo: swap };
  }
  return { dateFrom, dateTo };
}

export function csvEscape(value: unknown): string {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(columns: string[], rows: (string | number | null | undefined)[][]): string {
  const header = columns.map(csvEscape).join(',');
  const body = rows.map((row) => row.map((c) => csvEscape(c)).join(',')).join('\n');
  return '\uFEFF' + header + '\n' + body;
}
