'use client';

/**
 * Client table for notification templates with column sorting and pagination.
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

const NOTIF_TEMPLATES_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'name', label: 'Название' },
  { id: 'subject', label: 'Тема (email)' },
  { id: 'type', label: 'Канал' },
];

const TYPE_LABEL: Record<string, string> = {
  internal: 'Только в ленте',
  email: 'Только email',
  both: 'Лента и email',
};

export interface NotifTemplateRow {
  id: string;
  name: string;
  subject: string | null;
  type: string;
}


export function NotificationTemplatesTableClient({ templates }: { templates: NotifTemplateRow[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => NOTIF_TEMPLATES_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleExportExcel = () => {
    const headers = ['Название', 'Тема (email)', 'Канал'];
    const rows = sorted.map((t) => [t.name, t.subject ?? '—', TYPE_LABEL[t.type] ?? t.type]);
    downloadXlsxFromArrays(headers, rows, `notification-templates-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const sortGetters: Record<string, (t: NotifTemplateRow) => unknown> = {
    name: (t) => t.name,
    subject: (t) => t.subject ?? '',
    type: (t) => t.type,
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
              <SortableTableHead sortKey="subject" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Тема (email)</SortableTableHead>
              <SortableTableHead sortKey="type" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Канал</SortableTableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((t, idx) => (
              <TableRow key={t.id}>
                <TableCell className="text-[var(--portal-text-muted)]">{start + idx + 1}</TableCell>
                <TableCell className="font-medium text-[var(--portal-text)]">
                  <Link href={`/portal/admin/notification-templates/${t.id}`} className="text-[var(--portal-accent)] hover:underline">
                    {t.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-[var(--portal-text-muted)]">{t.subject ?? '—'}</TableCell>
                <TableCell className="text-[var(--portal-text-muted)]">{TYPE_LABEL[t.type] ?? t.type}</TableCell>
                <TableCell>
                  <Link href={`/portal/admin/notification-templates/${t.id}`}>
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
          columnConfig={NOTIF_TEMPLATES_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      )}
    </>
  );
}
