/**
 * Client-side CSV export for tables (Excel-compatible UTF-8).
 */
function escapeCsvCell(v: unknown): string {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  key: keyof T | ((row: T) => unknown);
  header: string;
}

/**
 * Build CSV string from rows and columns. Use downloadCsv to trigger file download.
 */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((col) => {
      const value = typeof col.key === 'function' ? col.key(row) : row[col.key];
      return escapeCsvCell(value);
    }).join(',')
  );
  return [header, ...body].join('\n');
}

/**
 * Trigger download of CSV file (Excel opens it with UTF-8 if BOM present).
 */
export function downloadCsv(csv: string, filename: string): void {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
