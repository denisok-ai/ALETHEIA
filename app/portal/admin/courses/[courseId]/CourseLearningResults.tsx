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
import { TablePagination } from '@/components/ui/TablePagination';
import { buildCsv, downloadCsv } from '@/lib/export-csv';

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

const SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'no_source', label: 'Без источника' },
] as const;

function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (seconds >= 60) return `${Math.floor(seconds / 60)} мин`;
  return `${seconds} сек`;
}

const PAGE_SIZES = [5, 10, 50];

export function CourseLearningResults({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [certGenerating, setCertGenerating] = useState(false);
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
    if (sourceFilter === 'no_source') {
      // Пока нет поля «источник» у записи — показываем всех
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const name = (e.user.displayName ?? '').toLowerCase();
    const email = (e.user.email ?? '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const handleExportExcel = () => {
    const csv = buildCsv(filtered, [
      { key: (r) => r.user.email, header: 'Email' },
      { key: (r) => r.user.displayName, header: 'Имя' },
      { key: 'status', header: 'Статус' },
      { key: (r) => r.progress.percent, header: '%' },
      { key: (r) => r.progress.completedLessons, header: 'Уроков' },
      { key: (r) => r.progress.totalLessons, header: 'Всего' },
      { key: (r) => r.certificate?.certNumber ?? '', header: 'Сертификат' },
    ]);
    downloadCsv(csv, `results-${courseId}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)]"
            aria-label="Фильтр по источнику"
          >
            {SOURCE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
          <div className="mt-4 overflow-x-auto">
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
                  <TableHead>Участник</TableHead>
                  <TableHead>Попыток</TableHead>
                  <TableHead>Первый запуск</TableHead>
                  <TableHead>Окончание</TableHead>
                  <TableHead>Затрачено времени</TableHead>
                  <TableHead>Последнее обращение</TableHead>
                  <TableHead>Пройдено</TableHead>
                  <TableHead>Баллов</TableHead>
                  <TableHead>Оценка в %</TableHead>
                  <TableHead>Проходной балл</TableHead>
                  <TableHead>Статус прохождения</TableHead>
                  <TableHead>Завершение</TableHead>
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
                    <TableCell>{row.attempts}</TableCell>
                    <TableCell className="text-[var(--portal-text-muted)] text-sm">
                      {row.firstActivityAt
                        ? format(new Date(row.firstActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-[var(--portal-text-muted)] text-sm">
                      {row.lastActivityAt
                        ? format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">
                      {row.progress.totalTimeSeconds > 0
                        ? formatTime(row.progress.totalTimeSeconds)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-[var(--portal-text-muted)] text-sm">
                      {row.lastActivityAt
                        ? format(new Date(row.lastActivityAt), 'dd.MM.yyyy HH:mm', { locale: ru })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {row.progress.totalLessons > 0 ? `${row.progress.percent}%` : '—'}
                    </TableCell>
                    <TableCell>
                      {row.progress.avgScore != null ? String(row.progress.avgScore) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.progress.avgScore != null ? `${row.progress.avgScore}%` : 'Неопределено'}
                    </TableCell>
                    <TableCell className="text-[var(--portal-text-muted)]">—</TableCell>
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
                    <TableCell>
                      {row.status === 'completed' ? 'Завершено' : 'Не завершено'}
                    </TableCell>
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

          <div className="mt-4 border-t border-[#E2E8F0] pt-3">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
              onExportExcel={handleExportExcel}
              exportLabel="Excel"
            />
          </div>
        </>
      )}
    </div>
  );
}
