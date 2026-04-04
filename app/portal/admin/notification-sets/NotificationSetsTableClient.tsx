'use client';

/**
 * Client table for notification sets with column sorting and pagination.
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
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';
import { getNotificationSetEventLabel } from '@/lib/notification-set-events';
import { FileText } from 'lucide-react';

const NOTIFICATION_SETS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'eventType', label: 'Тип события' },
  { id: 'name', label: 'Название' },
  { id: 'isDefault', label: 'По умолчанию' },
];

export interface NotificationSetRow {
  id: string;
  eventType: string;
  name: string;
  isDefault: boolean;
}

const NOTIFICATION_SET_SORT_GETTERS: Record<string, (s: NotificationSetRow) => unknown> = {
  eventType: (s) => s.eventType,
  name: (s) => s.name,
  isDefault: (s) => (s.isDefault ? 1 : 0),
};

export function NotificationSetsTableClient({ sets }: { sets: NotificationSetRow[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => NOTIFICATION_SETS_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);

  const handleExportExcel = () => {
    const headers = ['Тип события', 'Название', 'По умолчанию'];
    const rows = sorted.map((s) => [
      getNotificationSetEventLabel(s.eventType),
      s.name,
      s.isDefault ? 'Да' : 'Нет',
    ]);
    downloadXlsxFromArrays(headers, rows, `notification-sets-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !NOTIFICATION_SET_SORT_GETTERS[sortKey]) return sets;
    return sortTableBy(sets, NOTIFICATION_SET_SORT_GETTERS[sortKey], sortDir);
  }, [sets, sortKey, sortDir]);

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
              <SortableTableHead sortKey="eventType" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Тип события</SortableTableHead>
              <SortableTableHead sortKey="name" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Название</SortableTableHead>
              <SortableTableHead sortKey="isDefault" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="w-24">По умолчанию</SortableTableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((s, idx) => (
              <TableRow key={s.id}>
                <TableCell className="text-[var(--portal-text-muted)]">{start + idx + 1}</TableCell>
                <TableCell className="text-[var(--portal-text-muted)]">
                  {getNotificationSetEventLabel(s.eventType)}
                </TableCell>
                <TableCell className="font-medium text-[var(--portal-text)]">
                  <Link
                    href={`/portal/admin/notification-sets/${s.id}`}
                    className="text-[var(--portal-accent)] hover:underline"
                  >
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="text-[var(--portal-text-muted)]">{s.isDefault ? 'Да' : 'Нет'}</TableCell>
                <TableCell>
                  <Link
                    href={`/portal/admin/notification-sets/${s.id}`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-8 gap-1')}
                  >
                    <FileText className="h-4 w-4" />
                    Подробнее
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
          columnConfig={NOTIFICATION_SETS_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      )}
    </>
  );
}
