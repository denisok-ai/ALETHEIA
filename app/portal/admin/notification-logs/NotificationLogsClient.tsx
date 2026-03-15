'use client';

/**
 * Notification logs table with filters, column sorting and pagination.
 */
import { useState, useMemo } from 'react';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';
import { Bell } from 'lucide-react';

const LOGS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'date', label: 'Дата' },
  { id: 'recipient', label: 'Получатель' },
  { id: 'event', label: 'Событие' },
  { id: 'subject', label: 'Тема' },
  { id: 'channel', label: 'Канал' },
];
import { format } from 'date-fns';


export interface LogRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  eventType: string;
  subject: string | null;
  content: string;
  channel: string;
  createdAt: string;
}

const EVENT_TYPES = [
  { value: '', label: 'Все события' },
  { value: 'enrollment', label: 'Запись на курс' },
  { value: 'certificate_issued', label: 'Сертификат выдан' },
  { value: 'enrollment_excluded', label: 'Отчисление' },
  { value: 'access_opened', label: 'Доступ открыт' },
  { value: 'access_closed', label: 'Доступ закрыт' },
];

export function NotificationLogsClient({ initialLogs }: { initialLogs: LogRow[] }) {
  const [eventFilter, setEventFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => LOGS_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const handleExportExcel = () => {
    const headers = ['Дата', 'Получатель', 'Событие', 'Тема', 'Канал'];
    const rows = sorted.map((l) => [
      format(new Date(l.createdAt), 'dd.MM.yy HH:mm'),
      l.userDisplayName ?? l.userEmail ?? l.userId ?? '—',
      l.eventType,
      l.subject ?? '—',
      l.channel,
    ]);
    downloadXlsxFromArrays(headers, rows, `notification-logs-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let list = initialLogs;
    if (eventFilter) list = list.filter((l) => l.eventType === eventFilter);
    if (channelFilter) list = list.filter((l) => l.channel === channelFilter);
    return list;
  }, [initialLogs, eventFilter, channelFilter]);

  const logSortGetters: Record<string, (l: LogRow) => unknown> = {
    date: (l) => l.createdAt,
    recipient: (l) => l.userDisplayName ?? l.userEmail ?? l.userId ?? '',
    event: (l) => l.eventType,
    subject: (l) => l.subject ?? '',
    channel: (l) => l.channel,
    content: (l) => (l.content ?? '').slice(0, 100),
  };
  const sorted = useMemo(() => {
    if (!sortKey || !logSortGetters[sortKey]) return filtered;
    return sortTableBy(filtered, logSortGetters[sortKey], sortDir);
  }, [filtered, sortKey, sortDir]);

  const logsTotal = sorted.length;
  const logsTotalPages = Math.max(1, Math.ceil(logsTotal / pageSize));
  const logsCurrentPage = Math.min(page, logsTotalPages - 1);
  const logsStart = logsCurrentPage * pageSize;
  const logsPageRows = sorted.slice(logsStart, logsStart + pageSize);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
        >
          {EVENT_TYPES.map((e) => (
            <option key={e.value || 'all'} value={e.value}>{e.label}</option>
          ))}
        </select>
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
        >
          <option value="">Все каналы</option>
          <option value="internal">Внутренний</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">№</TableHead>
              <SortableTableHead sortKey="date" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Дата</SortableTableHead>
              <SortableTableHead sortKey="recipient" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Получатель</SortableTableHead>
              <SortableTableHead sortKey="event" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Событие</SortableTableHead>
              <SortableTableHead sortKey="subject" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Тема</SortableTableHead>
              <SortableTableHead sortKey="channel" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Канал</SortableTableHead>
              <SortableTableHead sortKey="content" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} className="max-w-[200px]">Контент (срез)</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    title="Нет записей"
                    description="Уведомления появятся после срабатывания событий"
                    icon={<Bell className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              logsPageRows.map((l, idx) => (
                <TableRow key={l.id}>
                  <TableCell className="text-[var(--portal-text-muted)]">{logsStart + idx + 1}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm whitespace-nowrap">
                    {format(new Date(l.createdAt), 'dd.MM.yy HH:mm')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.userDisplayName ?? l.userEmail ?? l.userId ?? '—'}
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">{l.eventType}</TableCell>
                  <TableCell className="text-sm line-clamp-1 max-w-[180px]">{l.subject ?? '—'}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-sm">{l.channel}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] text-xs line-clamp-2 max-w-[200px]">{l.content || '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {sorted.length > 0 && (
        <TablePagination
          currentPage={logsCurrentPage}
          totalPages={logsTotalPages}
          total={logsTotal}
          pageSize={pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          columnConfig={LOGS_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      )}
    </div>
  );
}
