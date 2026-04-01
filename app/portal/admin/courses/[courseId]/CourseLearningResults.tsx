'use client';

/**
 * Admin: вкладка «Результаты» — просмотр результатов прохождения по участникам,
 * переход к редактированию результатов, массовая генерация сертификатов.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ChevronDown, Search, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';

const LEARNING_RESULTS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'user', label: 'Участник' },
  { id: 'attempts', label: 'Попыток' },
  { id: 'firstActivityAt', label: 'Первый запуск' },
  { id: 'lastActivityAt', label: 'Окончание' },
  { id: 'totalTimeSeconds', label: 'Затрачено времени' },
  { id: 'percent', label: 'Пройдено' },
  { id: 'avgScore', label: 'Баллов' },
  { id: 'status', label: 'Статус прохождения' },
];
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import { sortTableBy, type SortDir } from '@/lib/table-sort';
import { downloadXlsx } from '@/lib/export-xlsx';

type EnrollmentRow = {
  id: string;
  userId: string;
  enrolledAt: string;
  lastActivityAt: string | null;
  firstActivityAt: string | null;
  attempts: number;
  status: 'not_started' | 'in_progress' | 'completed';
  user: { id: string; email: string; displayName: string | null };
  progress: {
    completedLessons: number;
    totalLessons: number;
    percent: number;
    avgScore: number | null;
    totalTimeSeconds: number;
  };
  certificate: { certNumber: string; issuedAt: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  completed: 'Завершено',
};


function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (seconds >= 60) return `${Math.floor(seconds / 60)} мин`;
  return `${seconds} сек`;
}

export function CourseLearningResults({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => LEARNING_RESULTS_TABLE_COLUMNS.map((c) => c.id));
  const [bulkOpen, setBulkOpen] = useState(false);
  const [certGenerating, setCertGenerating] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };
  const bulkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bulkOpen) return;
    const close = (e: MouseEvent) => {
      if (bulkRef.current?.contains(e.target as Node)) return;
      setBulkOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [bulkOpen]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/enrollments`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { enrollments: EnrollmentRow[] };
      setEnrollments(data.enrollments ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки');
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = enrollments.filter((e) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (e.user.displayName ?? '').toLowerCase();
    const email = (e.user.email ?? '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const resultsSortGetters: Record<string, (r: EnrollmentRow) => unknown> = {
    user: (r) => r.user.displayName ?? r.user.email,
    attempts: (r) => r.attempts,
    firstActivityAt: (r) => r.firstActivityAt ?? '',
    lastActivityAt: (r) => r.lastActivityAt ?? '',
    totalTimeSeconds: (r) => r.progress.totalTimeSeconds,
    percent: (r) => r.progress.percent,
    avgScore: (r) => r.progress.avgScore ?? -1,
    status: (r) => r.status,
  };
  const sorted = sortKey && resultsSortGetters[sortKey]
    ? sortTableBy(filtered, resultsSortGetters[sortKey], sortDir)
    : filtered;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const handleExportExcel = () => {
    downloadXlsx(sorted, [
      { key: (r) => r.user.email, header: 'Email' },
      { key: (r) => r.user.displayName, header: 'Имя' },
      { key: 'status', header: 'Статус' },
      { key: (r) => r.progress.percent, header: '%' },
      { key: (r) => r.progress.completedLessons, header: 'Уроков' },
      { key: (r) => r.progress.totalLessons, header: 'Всего' },
      { key: (r) => r.certificate?.certNumber ?? '', header: 'Сертификат' },
    ], `results-${courseId}-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size >= pageRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageRows.map((r) => r.id)));
    }
  };
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkSetResults = () => {
    setBulkOpen(false);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Выберите участников');
      return;
    }
    const first = enrollments.find((e) => e.id === ids[0]);
    if (first) {
      window.location.href = `/portal/admin/courses/${courseId}/enrollments/${first.userId}`;
    }
  };

  const handleBulkGenerateCerts = async () => {
    setBulkOpen(false);
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error('Выберите участников');
      return;
    }
    const userIds = enrollments.filter((e) => ids.includes(e.id)).map((e) => e.userId);
    setCertGenerating(true);
    try {
      const res = await fetch('/api/portal/admin/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, userIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Ошибка генерации сертификатов');
        return;
      }
      const count = data.created ?? 0;
      toast.success(`Сгенерировано ${count} сертификатов`);
      setSelectedIds(new Set());
      fetchData();
    } catch {
      toast.error('Ошибка генерации сертификатов');
    } finally {
      setCertGenerating(false);
    }
  };

  return (
    <div className="portal-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Результаты</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={bulkRef}>
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setBulkOpen(!bulkOpen);
              }}
              disabled={loading}
              className="gap-1"
            >
              Для выбранных
              <ChevronDown className="h-4 w-4" />
            </Button>
            {bulkOpen && (
              <div
                className="absolute left-0 top-full z-10 mt-1 min-w-[220px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#F8FAFC]"
                  onClick={handleBulkSetResults}
                >
                  Проставить результаты
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#F8FAFC] disabled:opacity-50"
                  onClick={handleBulkGenerateCerts}
                  disabled={certGenerating}
                >
                  Сгенерировать сертификаты
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
            <input
              type="search"
              placeholder="Найти в списке"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-lg border border-[#E2E8F0] bg-white py-2 pl-8 pr-3 text-sm text-[var(--portal-text)] placeholder:text-[var(--portal-text-muted)]"
              aria-label="Найти в списке"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={12} className="mt-4" />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Нет результатов"
          description="На курсе пока нет участников или данные не загружены"
          icon={<ClipboardList className="h-10 w-10" />}
        />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">№</TableHead>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && selectedIds.size >= pageRows.length}
                      onChange={toggleSelectAll}
                      aria-label="Выбрать все на странице"
                    />
                  </TableHead>
                  {visibleColumnIds.includes('user') && <SortableTableHead sortKey="user" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Участник</SortableTableHead>}
                  {visibleColumnIds.includes('attempts') && <SortableTableHead sortKey="attempts" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Попыток</SortableTableHead>}
                  {visibleColumnIds.includes('firstActivityAt') && <SortableTableHead sortKey="firstActivityAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Первый запуск</SortableTableHead>}
                  {visibleColumnIds.includes('lastActivityAt') && <SortableTableHead sortKey="lastActivityAt" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Окончание</SortableTableHead>}
                  {visibleColumnIds.includes('totalTimeSeconds') && <SortableTableHead sortKey="totalTimeSeconds" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Затрачено времени</SortableTableHead>}
                  {visibleColumnIds.includes('percent') && <SortableTableHead sortKey="percent" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Пройдено</SortableTableHead>}
                  {visibleColumnIds.includes('avgScore') && <SortableTableHead sortKey="avgScore" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Баллов</SortableTableHead>}
                  {visibleColumnIds.includes('status') && <SortableTableHead sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Статус прохождения</SortableTableHead>}
                  <TableHead className="w-32">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-[var(--portal-text-muted)]">{start + idx + 1}</TableCell>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        aria-label={`Выбрать ${row.user.displayName || row.user.email}`}
                      />
                    </TableCell>
                    {visibleColumnIds.includes('user') && (
                      <TableCell>
                        <Link
                          href={`/portal/admin/users/${row.userId}`}
                          className="font-medium text-[#6366F1] hover:underline"
                        >
                          {row.user.displayName || row.user.email}
                        </Link>
                        {row.user.displayName && (
                          <span className="ml-1 block text-xs text-[var(--portal-text-muted)]">{row.user.email}</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('attempts') && <TableCell>{row.attempts}</TableCell>}
                    {visibleColumnIds.includes('firstActivityAt') && (
                      <TableCell className="text-[var(--portal-text-muted)] text-sm">
                        {row.firstActivityAt
                          ? format(new Date(row.firstActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                          : '—'}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('lastActivityAt') && (
                      <TableCell className="text-[var(--portal-text-muted)] text-sm">
                        {row.lastActivityAt
                          ? format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                          : '—'}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('totalTimeSeconds') && (
                      <TableCell className="text-[var(--portal-text-muted)]">
                        {row.progress.totalTimeSeconds > 0
                          ? formatTime(row.progress.totalTimeSeconds)
                          : '—'}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('percent') && (
                      <TableCell>
                        {row.progress.totalLessons > 0 ? `${row.progress.percent}%` : '—'}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('avgScore') && (
                      <TableCell>
                        {row.progress.avgScore != null ? String(row.progress.avgScore) : '—'}
                      </TableCell>
                    )}
                    {visibleColumnIds.includes('status') && (
                      <TableCell>
                        <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          row.status === 'completed'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                            : row.status === 'in_progress'
                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-700'
                              : 'border-[#E2E8F0] bg-[#F8FAFC] text-[var(--portal-text-muted)]'
                        }`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </TableCell>
                    )}
                    <TableCell>
                      <Link
                        href={`/portal/admin/courses/${courseId}/enrollments/${row.userId}`}
                        className="text-sm text-[#6366F1] hover:underline"
                      >
                        Подробные результаты
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {total > 0 && (
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={STANDARD_PAGE_SIZES}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
              columnConfig={LEARNING_RESULTS_TABLE_COLUMNS}
              visibleColumnIds={visibleColumnIds}
              onVisibleColumnIdsChange={setVisibleColumnIds}
              onExportExcel={handleExportExcel}
              exportLabel="Excel"
            />
          )}
        </>
      )}
    </div>
  );
}
