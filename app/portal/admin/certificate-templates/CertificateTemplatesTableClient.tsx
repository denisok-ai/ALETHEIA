'use client';

/**
 * Client table for certificate templates with column sorting and pagination.
 */
import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import { sortTableBy, type SortDir } from '@/lib/table-sort';
import { Button } from '@/components/ui/button';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';

const CERT_TEMPLATES_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'name', label: 'Название' },
  { id: 'courseTitle', label: 'Курс' },
  { id: 'minScore', label: 'minScore' },
  { id: 'download', label: 'Скачивание' },
  { id: 'count', label: 'Сертификатов' },
];

export interface CertTemplateRow {
  id: string;
  name: string;
  courseTitle: string | null;
  backgroundImageUrl: string | null;
  minScore: number | null;
  allowUserDownload: boolean;
  certificatesCount: number;
}


export function CertificateTemplatesTableClient({ templates }: { templates: CertTemplateRow[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => CERT_TEMPLATES_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleExportExcel = () => {
    const headers = ['Название', 'Курс', 'Подложка', 'minScore', 'Скачивание', 'Сертификатов'];
    const rows = sorted.map((t) => [
      t.name,
      t.courseTitle ?? '—',
      t.backgroundImageUrl ? 'Да' : '—',
      t.minScore ?? '—',
      t.allowUserDownload ? 'Да' : 'Нет',
      String(t.certificatesCount),
    ]);
    downloadXlsxFromArrays(headers, rows, `certificate-templates-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const sortGetters: Record<string, (t: CertTemplateRow) => unknown> = {
    name: (t) => t.name,
    courseTitle: (t) => t.courseTitle ?? '',
    background: (t) => (t.backgroundImageUrl ? 1 : 0),
    minScore: (t) => t.minScore ?? -1,
    download: (t) => (t.allowUserDownload ? 1 : 0),
    count: (t) => t.certificatesCount,
  };
  const sorted = useMemo(() => {
    if (!sortKey || !sortGetters[sortKey]) return templates;
    return sortTableBy(templates, sortGetters[sortKey], sortDir);
  }, [templates, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">№</TableHead>
              <SortableTableHead sortKey="name" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Название</SortableTableHead>
              <SortableTableHead sortKey="courseTitle" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Курс</SortableTableHead>
              <SortableTableHead sortKey="background" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Подложка</SortableTableHead>
              <SortableTableHead sortKey="minScore" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="text-center">minScore</SortableTableHead>
              <SortableTableHead sortKey="download" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="text-center">Скачивание</SortableTableHead>
              <SortableTableHead sortKey="count" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="text-center">Сертификатов</SortableTableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((t, idx) => (
              <TableRow key={t.id}>
                <TableCell className="text-[var(--portal-text-muted)]">{start + idx + 1}</TableCell>
                <TableCell className="font-medium text-[var(--portal-text)]">
                  <Link href={`/portal/admin/certificate-templates/${t.id}`} className="text-[var(--portal-accent)] hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell className="text-[var(--portal-text-muted)] text-sm">{t.courseTitle ?? '—'}</TableCell>
                <TableCell className="text-[var(--portal-text-muted)] text-sm">{t.backgroundImageUrl ? 'Да' : '—'}</TableCell>
                <TableCell className="text-center text-[var(--portal-text-muted)]">{t.minScore ?? '—'}</TableCell>
                <TableCell className="text-center text-[var(--portal-text)]">{t.allowUserDownload ? 'Да' : 'Нет'}</TableCell>
                <TableCell className="text-center text-[var(--portal-text-muted)]">{t.certificatesCount}</TableCell>
                <TableCell>
                  <Link href={`/portal/admin/certificate-templates/${t.id}`}>
                    <Button variant="secondary" size="sm">Изменить</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {sorted.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          columnConfig={CERT_TEMPLATES_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      )}
    </>
  );
}
