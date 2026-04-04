'use client';

/**
 * Таблица заявок на верификацию: все статусы, фильтры, серверная пагинация (как тикеты менеджера).
 */
import { useState, useEffect, useCallback, useMemo, useId } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { ThreadCommentSerialized } from '@/lib/verification-thread-comments';
import { VerificationThreadComments } from '@/components/portal/VerificationThreadComments';
import { isOpenableVideoMaterialUrl } from '@/lib/verification-submission';

function rowActionLabel(r: VerificationTableRow): string {
  const course = (r.courseTitle || r.courseId || 'курс').slice(0, 80);
  return `${r.studentLabel}, ${course}`;
}

const VERIF_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'createdAt', label: 'Создано' },
  { id: 'student', label: 'Слушатель' },
  { id: 'course', label: 'Курс' },
  { id: 'type', label: 'Тип' },
  { id: 'status', label: 'Статус' },
  { id: 'material', label: 'Материал' },
  { id: 'reviewedAt', label: 'Проверено' },
  { id: 'reviewer', label: 'Проверяющий' },
  { id: 'actions', label: 'Действия' },
];

export interface VerificationTableRow {
  id: string;
  userId: string;
  studentEmail: string;
  studentLabel: string;
  courseId: string;
  courseTitle: string;
  lessonId: string | null;
  assignmentType: string;
  videoUrl: string;
  submissionPreview: string;
  status: string;
  comment: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewerLabel: string | null;
}

const STATUS_UI: Record<string, { label: string; cls: string }> = {
  pending: { label: 'На проверке', cls: 'badge-warn' },
  approved: { label: 'Одобрено', cls: 'badge-active' },
  rejected: { label: 'Отклонено', cls: 'badge-neutral' },
};

export function VerificationsTableClient({
  viewerUserId,
  userHrefPrefix,
  verificationsBasePath,
}: {
  viewerUserId: string;
  userHrefPrefix: string;
  /** Базовый URL списка заявок (для ссылки «сбросить фильтр userId»). */
  verificationsBasePath: string;
}) {
  const searchParams = useSearchParams();
  const filterUserId = searchParams.get('userId')?.trim() ?? '';

  const [items, setItems] = useState<VerificationTableRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() =>
    VERIF_TABLE_COLUMNS.map((c) => c.id)
  );
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState<string>('all');
  const [qInput, setQInput] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [courseIdInput, setCourseIdInput] = useState('');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [textModal, setTextModal] = useState<{ title: string; body: string } | null>(null);
  const [commentsModal, setCommentsModal] = useState<{
    id: string;
    comments: ThreadCommentSerialized[];
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(qInput.trim()), 400);
    return () => clearTimeout(t);
  }, [qInput]);

  const fetchList = useCallback(
    async (opts?: { exportMode?: boolean }) => {
      const exportMode = opts?.exportMode ?? false;
      const params = new URLSearchParams({
        page: exportMode ? '0' : String(page),
        pageSize: exportMode ? String(5000) : String(pageSize),
        sortKey,
        sortDir,
        status: statusFilter,
        assignmentType: assignmentTypeFilter,
      });
      if (filterUserId) params.set('userId', filterUserId);
      if (courseIdInput.trim()) params.set('courseId', courseIdInput.trim());
      if (qDebounced) params.set('q', qDebounced);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (exportMode) params.set('export', '1');

      if (!exportMode) setLoading(true);
      try {
        const res = await fetch(`/api/portal/manager/verifications?${params}`);
        if (!res.ok) throw new Error('Ошибка загрузки');
        const data = await res.json();
        const list = (data.items ?? []) as VerificationTableRow[];
        if (!exportMode) {
          setItems(list);
          setTotal(data.total ?? 0);
        }
        return list;
      } catch {
        if (!exportMode) {
          toast.error('Не удалось загрузить заявки');
          setItems([]);
          setTotal(0);
        } else {
          toast.error('Не удалось выгрузить Excel');
        }
        return [];
      } finally {
        if (!exportMode) setLoading(false);
      }
    },
    [
      page,
      pageSize,
      sortKey,
      sortDir,
      statusFilter,
      assignmentTypeFilter,
      filterUserId,
      courseIdInput,
      qDebounced,
      dateFrom,
      dateTo,
    ]
  );

  useEffect(() => {
    setPage(0);
  }, [
    filterUserId,
    statusFilter,
    assignmentTypeFilter,
    qDebounced,
    dateFrom,
    dateTo,
    courseIdInput,
  ]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(columnId);
      setSortDir(columnId === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const handleExportExcel = async () => {
    const list = await fetchList({ exportMode: true });
    const headers = [
      'Создано',
      'Слушатель',
      'Email',
      'Курс',
      'Урок',
      'Тип',
      'Статус',
      'Проверено',
      'Проверяющий',
      'Превью',
    ];
    const rows = list.map((r) => {
      const st = STATUS_UI[r.status] ?? { label: r.status };
      return [
        format(new Date(r.createdAt), 'dd.MM.yy HH:mm'),
        r.studentLabel,
        r.studentEmail,
        r.courseTitle || r.courseId,
        r.lessonId ?? '—',
        r.assignmentType === 'text' ? 'Текст' : 'Видео',
        st.label,
        r.reviewedAt ? format(new Date(r.reviewedAt), 'dd.MM.yy HH:mm') : '—',
        r.reviewerLabel ?? '—',
        r.submissionPreview,
      ];
    });
    downloadXlsxFromArrays(headers, rows, `verifications-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  async function postDecision(id: string, status: 'approved' | 'rejected', comment?: string) {
    setActionLoading(id);
    try {
      const res = await fetch('/api/portal/manager/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, ...(status === 'rejected' && comment !== undefined ? { comment } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Ошибка');
        return;
      }
      if (status === 'approved') {
        const n = data.xpAwarded;
        toast.success(
          typeof n === 'number' && n > 0 ? `Одобрено. Начислено +${n} к заряду` : 'Одобрено'
        );
      } else {
        toast.success('Отклонено');
      }
      setRejectOpen(false);
      setRejectId(null);
      setRejectComment('');
      await fetchList();
    } catch {
      toast.error('Ошибка соединения');
    } finally {
      setActionLoading(null);
    }
  }

  function openComments(row: VerificationTableRow) {
    setCommentsModal({ id: row.id, comments: [], loading: true });
    fetch(`/api/portal/verifications/${row.id}/comments`)
      .then((r) => r.json())
      .then((d) => {
        setCommentsModal((prev) =>
          prev && prev.id === row.id
            ? { ...prev, comments: d.comments ?? [], loading: false }
            : prev
        );
      })
      .catch(() => {
        setCommentsModal((prev) =>
          prev && prev.id === row.id ? { ...prev, comments: [], loading: false } : prev
        );
        toast.error('Не удалось загрузить комментарии');
      });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);

  const col = useMemo(() => new Set(visibleColumnIds), [visibleColumnIds]);
  const show = (id: string) => col.has(id);

  if (loading && items.length === 0) {
    return (
      <div className="portal-card p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--portal-accent)] mx-auto" aria-hidden />
        <p className="mt-4 text-sm text-[var(--portal-text-muted)]">Загрузка заявок…</p>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="portal-card flex flex-wrap items-end gap-3 p-4">
          <FilterControls
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            assignmentTypeFilter={assignmentTypeFilter}
            setAssignmentTypeFilter={setAssignmentTypeFilter}
            qInput={qInput}
            setQInput={setQInput}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            courseIdInput={courseIdInput}
            setCourseIdInput={setCourseIdInput}
            onReset={() => {
              setStatusFilter('all');
              setAssignmentTypeFilter('all');
              setQInput('');
              setDateFrom('');
              setDateTo('');
              setCourseIdInput('');
            }}
          />
        </div>
        <div className="portal-card p-10 text-center">
          <p className="text-lg font-semibold text-[var(--portal-text)]">Нет заявок по фильтру</p>
          <p className="mt-2 text-sm text-[var(--portal-text-muted)]">
            Измените статус, период или поиск.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {filterUserId && (
        <div className="portal-card border border-[var(--portal-accent-muted)] bg-[var(--portal-accent-soft)] px-4 py-2 text-sm text-[var(--portal-text)]">
          Показаны заявки только этого пользователя.{' '}
          <Link href={verificationsBasePath} className="font-medium text-[var(--portal-accent)] underline">
            Сбросить фильтр
          </Link>
        </div>
      )}

      <div className="portal-card flex flex-wrap items-end gap-3 p-4">
        <FilterControls
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          assignmentTypeFilter={assignmentTypeFilter}
          setAssignmentTypeFilter={setAssignmentTypeFilter}
          qInput={qInput}
          setQInput={setQInput}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          courseIdInput={courseIdInput}
          setCourseIdInput={setCourseIdInput}
          onReset={() => {
            setStatusFilter('all');
            setAssignmentTypeFilter('all');
            setQInput('');
            setDateFrom('');
            setDateTo('');
            setCourseIdInput('');
          }}
        />
      </div>

      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                {show('createdAt') && (
                  <SortableTableHead
                    sortKey="createdAt"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  >
                    Создано
                  </SortableTableHead>
                )}
                {show('student') && (
                  <SortableTableHead
                    sortKey="student"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  >
                    Слушатель
                  </SortableTableHead>
                )}
                {show('course') && (
                  <SortableTableHead
                    sortKey="course"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  >
                    Курс
                  </SortableTableHead>
                )}
                {show('type') && <TableHead>Тип</TableHead>}
                {show('status') && (
                  <SortableTableHead
                    sortKey="status"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  >
                    Статус
                  </SortableTableHead>
                )}
                {show('material') && <TableHead>Материал</TableHead>}
                {show('reviewedAt') && (
                  <SortableTableHead
                    sortKey="reviewedAt"
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={handleSort}
                  >
                    Проверено
                  </SortableTableHead>
                )}
                {show('reviewer') && <TableHead>Проверяющий</TableHead>}
                {show('actions') && <TableHead className="w-[1%] whitespace-nowrap">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => {
                const st = STATUS_UI[r.status] ?? { label: r.status, cls: 'badge-neutral' };
                const busy = actionLoading === r.id;
                const rowCtx = rowActionLabel(r);
                const videoOpenable = isOpenableVideoMaterialUrl(r.videoUrl);
                return (
                  <TableRow key={r.id} className="border-b border-[#E2E8F0] last:border-0">
                    {show('createdAt') && (
                      <TableCell className="text-[var(--portal-text-muted)] whitespace-nowrap">
                        {format(new Date(r.createdAt), 'dd.MM.yy HH:mm')}
                      </TableCell>
                    )}
                    {show('student') && (
                      <TableCell>
                        <Link
                          href={`${userHrefPrefix}/${r.userId}`}
                          className="font-medium text-[var(--portal-text)] hover:text-[var(--portal-accent)] hover:underline"
                        >
                          {r.studentLabel}
                        </Link>
                        <div className="text-xs text-[var(--portal-text-soft)] truncate max-w-[200px]">
                          {r.studentEmail}
                        </div>
                      </TableCell>
                    )}
                    {show('course') && (
                      <TableCell className="text-[var(--portal-text-muted)] max-w-[200px]">
                        <span className="line-clamp-2" title={r.courseTitle}>
                          {r.courseTitle || r.courseId}
                        </span>
                      </TableCell>
                    )}
                    {show('type') && (
                      <TableCell className="text-sm">
                        {r.assignmentType === 'text' ? 'Текст' : 'Видео'}
                      </TableCell>
                    )}
                    {show('status') && (
                      <TableCell>
                        <span className={`status-badge ${st.cls}`}>{st.label}</span>
                      </TableCell>
                    )}
                    {show('material') && (
                      <TableCell className="max-w-[220px]">
                        {r.assignmentType === 'text' ? (
                          <button
                            type="button"
                            className="text-left text-sm text-[var(--portal-accent)] hover:underline line-clamp-2"
                            aria-label={`Текст ответа слушателя: ${rowCtx}`}
                            onClick={() =>
                              setTextModal({ title: 'Текст ответа', body: r.videoUrl })
                            }
                          >
                            {r.submissionPreview}
                          </button>
                        ) : videoOpenable ? (
                          <a
                            href={r.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[var(--portal-accent)] hover:underline truncate max-w-full"
                            aria-label={`Открыть материал: ${rowCtx}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{r.submissionPreview}</span>
                          </a>
                        ) : (
                          <span
                            className="text-sm text-[var(--portal-text-muted)] line-clamp-2"
                            title={r.videoUrl ? `Сохранённое значение: ${r.videoUrl}` : undefined}
                          >
                            Файл или ссылка не указаны
                          </span>
                        )}
                      </TableCell>
                    )}
                    {show('reviewedAt') && (
                      <TableCell className="text-[var(--portal-text-muted)] whitespace-nowrap text-sm">
                        {r.reviewedAt ? format(new Date(r.reviewedAt), 'dd.MM.yy HH:mm') : '—'}
                      </TableCell>
                    )}
                    {show('reviewer') && (
                      <TableCell className="text-sm text-[var(--portal-text-muted)]">
                        {r.reviewerLabel ?? '—'}
                      </TableCell>
                    )}
                    {show('actions') && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            aria-label={`Чат по заявке: ${rowCtx}`}
                            onClick={() => openComments(r)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            <span className="sr-only md:not-sr-only md:ml-1">Чат</span>
                          </Button>
                          {r.status === 'pending' && (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 !bg-[#15803D]/15 !text-[#166534] hover:!bg-[#15803D]/25"
                                disabled={busy}
                                aria-label={`Одобрить заявку: ${rowCtx}`}
                                onClick={() => postDecision(r.id, 'approved')}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                OK
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8"
                                disabled={busy}
                                aria-label={`Отклонить заявку: ${rowCtx}`}
                                onClick={() => {
                                  setRejectId(r.id);
                                  setRejectComment('');
                                  setRejectOpen(true);
                                }}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Нет
                              </Button>
                            </>
                          )}
                        </div>
                        {r.status === 'rejected' && r.comment && (
                          <p className="mt-1 text-xs text-[var(--portal-text-muted)] line-clamp-2" title={r.comment}>
                            {r.comment}
                          </p>
                        )}
                      </TableCell>
                    )}
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
            columnConfig={VERIF_TABLE_COLUMNS}
            visibleColumnIds={visibleColumnIds}
            onVisibleColumnIdsChange={setVisibleColumnIds}
            onExportExcel={handleExportExcel}
            exportLabel="Excel"
          />
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отклонить заявку</DialogTitle>
          </DialogHeader>
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Комментарий для слушателя (необязательно)"
            rows={3}
            className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!rejectId || actionLoading !== null}
              onClick={() => rejectId && postDecision(rejectId, 'rejected', rejectComment)}
            >
              Отклонить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!textModal} onOpenChange={(o) => !o && setTextModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{textModal?.title}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap break-words text-sm text-[var(--portal-text)]">
            {textModal?.body}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={!!commentsModal} onOpenChange={(o) => !o && setCommentsModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Комментарии к заявке</DialogTitle>
          </DialogHeader>
          {commentsModal?.loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--portal-accent)]" />
            </div>
          ) : commentsModal ? (
            <VerificationThreadComments
              key={commentsModal.id}
              verificationId={commentsModal.id}
              viewerUserId={viewerUserId}
              initialComments={commentsModal.comments}
              canPost
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterControls({
  statusFilter,
  setStatusFilter,
  assignmentTypeFilter,
  setAssignmentTypeFilter,
  qInput,
  setQInput,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  courseIdInput,
  setCourseIdInput,
  onReset,
}: {
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  assignmentTypeFilter: string;
  setAssignmentTypeFilter: (v: string) => void;
  qInput: string;
  setQInput: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  courseIdInput: string;
  setCourseIdInput: (v: string) => void;
  onReset: () => void;
}) {
  const id = useId();
  const statusId = `${id}-status`;
  const typeId = `${id}-type`;
  const qId = `${id}-q`;
  const dateFromId = `${id}-from`;
  const dateToId = `${id}-to`;
  const courseId = `${id}-course`;

  const sel =
    'rounded-lg border border-[#E2E8F0] bg-white px-2 py-2 text-sm min-h-10 min-w-[140px]';
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={statusId} className="text-xs text-[var(--portal-text-muted)]">
          Статус
        </label>
        <select
          id={statusId}
          className={sel}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Статус заявки на верификацию"
        >
          <option value="all">Все</option>
          <option value="pending">На проверке</option>
          <option value="approved">Одобрено</option>
          <option value="rejected">Отклонено</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={typeId} className="text-xs text-[var(--portal-text-muted)]">
          Тип
        </label>
        <select
          id={typeId}
          className={sel}
          value={assignmentTypeFilter}
          onChange={(e) => setAssignmentTypeFilter(e.target.value)}
          aria-label="Тип заявки: видео или текст"
        >
          <option value="all">Все</option>
          <option value="video">Видео</option>
          <option value="text">Текст</option>
        </select>
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
        <label htmlFor={qId} className="text-xs text-[var(--portal-text-muted)]">
          Поиск (email / имя)
        </label>
        <input
          id={qId}
          type="search"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Часть email или имени"
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-h-10 w-full max-w-xs"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={dateFromId} className="text-xs text-[var(--portal-text-muted)]">
          С даты
        </label>
        <input
          id={dateFromId}
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Фильтр: дата создания заявки, с"
          className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-2 text-sm min-h-10"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={dateToId} className="text-xs text-[var(--portal-text-muted)]">
          По дату
        </label>
        <input
          id={dateToId}
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Фильтр: дата создания заявки, по"
          className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-2 text-sm min-h-10"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[140px]">
        <label htmlFor={courseId} className="text-xs text-[var(--portal-text-muted)]">
          ID курса
        </label>
        <input
          id={courseId}
          type="text"
          value={courseIdInput}
          onChange={(e) => setCourseIdInput(e.target.value)}
          placeholder="опционально"
          className="rounded-lg border border-[#E2E8F0] bg-white px-2 py-2 text-sm min-h-10"
        />
      </div>
      <Button type="button" variant="ghost" size="sm" className="min-h-10 self-end" onClick={onReset}>
        Сбросить
      </Button>
    </>
  );
}
