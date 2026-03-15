'use client';

/**
 * Таблица тикетов менеджера с серверной пагинацией и сортировкой.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import type { SortDir } from '@/lib/table-sort';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const TICKETS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'date', label: 'Дата' },
  { id: 'subject', label: 'Тема' },
  { id: 'user', label: 'Пользователь' },
  { id: 'status', label: 'Статус' },
];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  open: { label: 'Открыт', cls: 'badge-warn' },
  in_progress: { label: 'В работе', cls: 'badge-info' },
  resolved: { label: 'Решён', cls: 'badge-active' },
  closed: { label: 'Закрыт', cls: 'badge-neutral' },
};

export interface TicketRow {
  id: string;
  userId: string;
  subject: string;
  status: string;
  createdAt: string;
  user: {
    email: string;
    profile: { displayName: string | null; email: string | null } | null;
  } | null;
}

export function ManagerTicketsTableClient() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => TICKETS_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchTickets = useCallback(async (opts?: { exportMode?: boolean }) => {
    const exportMode = opts?.exportMode ?? false;
    const params = new URLSearchParams({
      page: exportMode ? '0' : String(page),
      pageSize: exportMode ? '5000' : String(pageSize),
      sortKey,
      sortDir,
    });
    if (exportMode) params.set('export', '1');
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/manager/tickets?${params}`);
      if (!res.ok) throw new Error('Ошибка загрузки');
      const data = await res.json();
      setTickets(data.tickets ?? []);
      if (!exportMode) setTotal(data.total ?? 0);
      return data.tickets as TicketRow[];
    } catch (e) {
      toast.error('Не удалось загрузить тикеты');
      setTickets([]);
      setTotal(0);
      return [];
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortKey, sortDir]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleExportExcel = async () => {
    const all = await fetch(`/api/portal/manager/tickets?export=1&sortKey=${sortKey}&sortDir=${sortDir}`).then((r) =>
      r.ok ? r.json() : { tickets: [] }
    );
    const list = (all.tickets ?? []) as TicketRow[];
    const headers = ['Дата', 'Тема', 'Пользователь', 'Статус'];
    const rows = list.map((t) => {
      const p = t.user?.profile;
      const name = p?.displayName ?? p?.email ?? t.user?.email ?? t.userId ?? '—';
      const s = STATUS_MAP[t.status] ?? { label: t.status };
      return [
        format(new Date(t.createdAt), 'dd.MM.yy HH:mm'),
        t.subject,
        name,
        s.label,
      ];
    });
    downloadXlsxFromArrays(headers, rows, `tickets-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(columnId);
      setSortDir(columnId === 'date' ? 'desc' : 'asc');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = tickets;

  if (loading && tickets.length === 0) {
    return (
      <div className="portal-card p-10 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal-accent)] border-t-transparent mx-auto" aria-hidden />
        <p className="mt-4 text-sm text-[var(--portal-text-muted)]">Загрузка тикетов…</p>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="portal-card p-10 text-center">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-[var(--portal-text-soft)]" />
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Нет тикетов</h2>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Новые обращения появятся здесь.</p>
      </div>
    );
  }

  return (
    <div className="portal-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F8FAFC]">
              <SortableTableHead sortKey="date" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                Дата
              </SortableTableHead>
              <SortableTableHead sortKey="subject" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                Тема
              </SortableTableHead>
              <SortableTableHead sortKey="user" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                Пользователь
              </SortableTableHead>
              <SortableTableHead sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>
                Статус
              </SortableTableHead>
              <TableHead className="w-8 px-4 py-3" aria-hidden />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((t) => {
              const p = t.user?.profile;
              const name = p?.displayName ?? p?.email ?? t.user?.email ?? t.userId.slice(0, 8);
              const s = STATUS_MAP[t.status] ?? { label: t.status, cls: 'badge-neutral' };
              return (
                <TableRow key={t.id} className="border-b border-[#E2E8F0] last:border-0">
                  <TableCell className="text-[var(--portal-text-muted)] whitespace-nowrap">
                    {format(new Date(t.createdAt), 'dd.MM.yy HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium text-[var(--portal-text)]">
                    <Link href={`/portal/manager/tickets/${t.id}`} className="hover:text-[#6366F1] transition-colors">
                      {t.subject}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">
                    <Link href={`/portal/manager/users/${t.userId}`} className="hover:text-[var(--portal-accent)] hover:underline">
                      {name ?? '—'}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className={`status-badge ${s.cls}`}>{s.label}</span>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/portal/manager/tickets/${t.id}`}
                      className="text-[var(--portal-text-soft)] hover:text-[#6366F1]"
                      aria-label="Открыть"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-[#E2E8F0] px-4 py-3 bg-[#F8FAFC]">
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(0);
          }}
          columnConfig={TICKETS_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      </div>
    </div>
  );
}
