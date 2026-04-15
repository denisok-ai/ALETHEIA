/**
 * Client-side XLSX export for tables. Uses same column shape as export-csv.
 */
import * as XLSX from 'xlsx';
import type { CsvColumn } from './export-csv';

function cellValue(v: unknown): string | number {
  if (v == null) return '';
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'boolean') return v ? 'Да' : 'Нет';
  return String(v);
}

/**
 * Build XLSX workbook from rows and columns, then trigger download.
 */
export function downloadXlsx<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const headers = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((col) => {
      const value = typeof col.key === 'function' ? col.key(row) : row[col.key];
      return cellValue(value);
    })
  );
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Данные');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as number[];
  const blob = new Blob([new Uint8Array(out)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build XLSX from raw headers and rows (for pages that build data manually).
 */
export function downloadXlsxFromArrays(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string
): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Данные');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as number[];
  const blob = new Blob([new Uint8Array(out)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
