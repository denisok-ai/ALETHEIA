'use client';

/**
 * Admin: вкладка Участники — список участников мероприятия, добавление, доступ, завершённость, исключение.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { UserPlus, ExternalLink, Trash2, Download, Users, Upload, ChevronDown, Lock, LockOpen, CheckCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
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

const BULK_LIMIT = 500;

type EnrollmentRow = {
  id: string;
  userId: string;
  courseId: string;
  enrolledAt: string;
  expiresAt: string | null;
  accessClosed: boolean;
  completedAt: string | null;
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

function formatTime(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  if (seconds >= 60) return `${Math.floor(seconds / 60)} мин`;
  return `${seconds} сек`;
}

export function CourseEnrollmentsClient({
  courseId,
  courseTitle,
}: {
  courseId: string;
  courseTitle: string;
}) {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; email: string; display_name: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EnrollmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUnenrollConfirm, setBulkUnenrollConfirm] = useState(false);
  const [bulkUnenrolling, setBulkUnenrolling] = useState(false);
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);
  const [bulkEnrollText, setBulkEnrollText] = useState('');
  const [bulkEnrolling, setBulkEnrolling] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [accessDropdownOpen, setAccessDropdownOpen] = useState(false);
  const [bulkAccessing, setBulkAccessing] = useState(false);
  const [togglingCompletion, setTogglingCompletion] = useState<string | null>(null);
  const [togglingAccess, setTogglingAccess] = useState<string | null>(null);
  const [listSelectOpen, setListSelectOpen] = useState(false);
  const [listSelectGroups, setListSelectGroups] = useState<{ id: string; name: string }[]>([]);
  const [listSelectGroupId, setListSelectGroupId] = useState<string>('');
  const [listSelectUsers, setListSelectUsers] = useState<{ id: string; email: string; displayName: string | null }[]>([]);
  const [listSelectSearch, setListSelectSearch] = useState('');
  const [listSelectSelectedIds, setListSelectSelectedIds] = useState<Set<string>>(new Set());
  const [listSelectLoading, setListSelectLoading] = useState(false);
  const [listSelectEnrolling, setListSelectEnrolling] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/enrollments`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { enrollments: EnrollmentRow[] };
      setEnrollments(data.enrollments ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Ошибка загрузки записей');
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  useEffect(() => {
    if (!addOpen || searchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/portal/manager/users/search?q=${encodeURIComponent(searchQ)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { profiles: { id: string; email: string; display_name: string | null }[] };
        setSearchResults(data.profiles ?? []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [addOpen, searchQ]);

  useEffect(() => {
    if (!listSelectOpen) return;
    fetch('/api/portal/admin/groups?moduleType=user')
      .then((r) => r.ok ? r.json() : { groups: [] })
      .then((d: { groups?: { id: string; name: string }[] }) => {
        setListSelectGroups(d.groups ?? []);
        setListSelectGroupId('');
      })
      .catch(() => setListSelectGroups([]));
  }, [listSelectOpen]);

  useEffect(() => {
    if (!listSelectOpen) return;
    const t = setTimeout(() => {
      setListSelectLoading(true);
      if (listSelectGroupId) {
        fetch(`/api/portal/admin/groups/${listSelectGroupId}/users`)
          .then((r) => r.ok ? r.json() : { users: [] })
          .then((d: { users?: { userId: string; email: string; displayName: string | null }[] }) => {
            const users = (d.users ?? []).map((u) => ({ id: u.userId, email: u.email, displayName: u.displayName }));
            setListSelectUsers(users);
          })
          .catch(() => setListSelectUsers([]))
          .finally(() => setListSelectLoading(false));
      } else {
        const q = listSelectSearch.trim();
        fetch(`/api/portal/admin/users?limit=200${q ? `&q=${encodeURIComponent(q)}` : ''}`)
          .then((r) => r.ok ? r.json() : { users: [] })
          .then((d: { users?: { id: string; email: string; displayName: string | null }[] }) => {
            setListSelectUsers(d.users ?? []);
          })
          .catch(() => setListSelectUsers([]))
          .finally(() => setListSelectLoading(false));
      }
    }, listSelectGroupId ? 0 : 400);
    return () => clearTimeout(t);
  }, [listSelectOpen, listSelectGroupId, listSelectSearch]);

  const listSelectFiltered = listSelectUsers.filter((u) => {
    const q = listSelectSearch.trim().toLowerCase();
    if (!q) return true;
    const name = (u.displayName ?? u.email ?? '').toLowerCase();
    const email = (u.email ?? '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  function toggleListSelectAll() {
    const enrollable = listSelectFiltered.filter((u) => !alreadyEnrolledIds.has(u.id));
    const allSelected = enrollable.every((u) => listSelectSelectedIds.has(u.id));
    if (allSelected) {
      setListSelectSelectedIds((prev) => {
        const next = new Set(prev);
        enrollable.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setListSelectSelectedIds((prev) => {
        const next = new Set(prev);
        enrollable.forEach((u) => next.add(u.id));
        return next;
      });
    }
  }

  async function handleListSelectEnroll() {
    const ids = Array.from(listSelectSelectedIds).filter((id) => !alreadyEnrolledIds.has(id));
    if (ids.length === 0) {
      toast.error('Выберите пользователей для записи');
      return;
    }
    setListSelectEnrolling(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/enrollments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: ids }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { enrolled: number; skipped: number; notFound: string[] };
      let msg = `Зачислено: ${data.enrolled}`;
      if (data.skipped) msg += `, пропущено (уже записаны): ${data.skipped}`;
      if (data.notFound?.length) msg += `, не найдено: ${data.notFound.length}`;
      toast.success(msg);
      setListSelectOpen(false);
      setListSelectSelectedIds(new Set());
      setListSelectSearch('');
      setListSelectGroupId('');
      fetchEnrollments();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка массового зачисления');
    }
    setListSelectEnrolling(false);
  }

  async function handleEnroll(userId: string) {
    setAdding(true);
    try {
      const res = await fetch('/api/portal/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409) {
          toast.error('Пользователь уже записан на курс');
          return;
        }
        throw new Error((err as { error?: string }).error || res.statusText);
      }
      toast.success('Пользователь записан на курс');
      setAddOpen(false);
      setSearchQ('');
      setSearchResults([]);
      fetchEnrollments();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка записи на курс');
    }
    setAdding(false);
  }

  async function handleSetAccess(enrollmentId: string, accessClosed: boolean) {
    setTogglingAccess(enrollmentId);
    try {
      const res = await fetch(`/api/portal/admin/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessClosed }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, accessClosed } : e))
      );
      toast.success(accessClosed ? 'Доступ закрыт' : 'Доступ открыт');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка');
    }
    setTogglingAccess(null);
  }

  async function handleSetCompletion(row: EnrollmentRow) {
    setTogglingCompletion(row.id);
    try {
      const completedAt = row.completedAt ? null : new Date().toISOString();
      const res = await fetch(`/api/portal/admin/enrollments/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEnrollments((prev) =>
        prev.map((e) => (e.id === row.id ? { ...e, completedAt } : e))
      );
      toast.success(completedAt ? 'Участие завершено' : 'Статус сброшен');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка');
    }
    setTogglingCompletion(null);
  }

  async function handleBulkAccess(accessClosed: boolean) {
    setAccessDropdownOpen(false);
    setBulkAccessing(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/enrollments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessClosed }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEnrollments((prev) => prev.map((e) => ({ ...e, accessClosed })));
      toast.success(accessClosed ? 'Доступ закрыт всем' : 'Доступ открыт всем');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка');
    }
    setBulkAccessing(false);
  }

  async function handleDelete(row: EnrollmentRow) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/portal/admin/enrollments/${row.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success('Запись на курс удалена');
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
      fetchEnrollments();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка удаления');
    }
    setDeleting(false);
  }

  const selectedArr = Array.from(selectedIds);

  function toggleSelectAll() {
    const visible = listFiltered;
    if (visible.length === 0) return;
    const allSelected = visible.every((e) => selectedIds.has(e.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map((e) => e.id)));
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkUnenroll() {
    if (selectedArr.length === 0) return;
    setBulkUnenrollConfirm(false);
    setBulkUnenrolling(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/enrollments/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentIds: selectedArr }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { deleted: number };
      toast.success(`Отчислено: ${data.deleted}`);
      setSelectedIds(new Set());
      fetchEnrollments();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка массового отчисления');
    }
    setBulkUnenrolling(false);
  }

  function parseBulkInput(text: string): string[] {
    return text
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, BULK_LIMIT);
  }

  async function handleBulkEnrollSubmit() {
    const lines = parseBulkInput(bulkEnrollText);
    if (lines.length === 0) {
      toast.error('Введите email или ID пользователей (по одному на строку)');
      return;
    }
    const looksLikeIds = lines.every((s) => s.length >= 20 && !s.includes('@'));
    setBulkEnrolling(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/enrollments/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          looksLikeIds ? { userIds: lines } : { emails: lines }
        ),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { enrolled: number; skipped: number; notFound: string[] };
      let msg = `Зачислено: ${data.enrolled}`;
      if (data.skipped) msg += `, пропущено (уже записаны): ${data.skipped}`;
      if (data.notFound?.length) msg += `, не найдено: ${data.notFound.length}`;
      toast.success(msg);
      if (data.notFound?.length && data.notFound.length <= 10) {
        toast.info(`Не найдены: ${data.notFound.join(', ')}`);
      } else if (data.notFound?.length > 10) {
        toast.info(`Не найдены (первые 10): ${data.notFound.slice(0, 10).join(', ')}…`);
      }
      setBulkEnrollOpen(false);
      setBulkEnrollText('');
      fetchEnrollments();
    } catch (e) {
      console.error(e);
      toast.error('Ошибка массового зачисления');
    }
    setBulkEnrolling(false);
  }

  function handleBulkEnrollCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).map((line) => {
        const first = line.split(',')[0]?.trim() ?? '';
        return first;
      }).filter(Boolean).slice(0, BULK_LIMIT);
      setBulkEnrollText(lines.join('\n'));
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }

  const alreadyEnrolledIds = new Set(enrollments.map((e) => e.userId));

  const listFiltered =
    !listSearch.trim()
      ? enrollments
      : enrollments.filter((e) => {
          const q = listSearch.trim().toLowerCase();
          const name = (e.user.displayName ?? e.user.email ?? '').toLowerCase();
          const email = (e.user.email ?? '').toLowerCase();
          return name.includes(q) || email.includes(q);
        });

  function escapeCsv(s: string): string {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function handleExportCsv() {
    const headers = ['email', 'display_name', 'enrolled_at', 'progress_percent', 'avg_score', 'total_time_sec', 'cert_number'];
    const rows = enrollments.map((e) => [
      e.user.email,
      e.user.displayName ?? '',
      format(new Date(e.enrolledAt), 'yyyy-MM-dd HH:mm'),
      String(e.progress.percent),
      e.progress.avgScore != null ? String(e.progress.avgScore) : '',
      String(e.progress.totalTimeSeconds),
      e.certificate?.certNumber ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enrollments-${courseTitle.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Экспорт выполнен');
  }

  function formatPeriod(enrolledAt: string, expiresAt: string | null) {
    const start = new Date(enrolledAt).toLocaleDateString('ru-Cyrl', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const end = expiresAt ? new Date(expiresAt).toLocaleDateString('ru-Cyrl', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
    return `${start} – ${end}`;
  }

  return (
    <div className="portal-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Участники</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => { setListSelectOpen(true); setAccessDropdownOpen(false); }}>
              <UserPlus className="mr-2 h-4 w-4" />
              Добавить
            </Button>
          </div>
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setAccessDropdownOpen((v) => !v)} disabled={enrollments.length === 0 || bulkAccessing}>
              <LockOpen className="mr-2 h-4 w-4" />
              Доступ
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
            {accessDropdownOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg">
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[#F8FAFC]" onClick={() => handleBulkAccess(false)}>
                  Открыть всем
                </button>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[#F8FAFC]" onClick={() => handleBulkAccess(true)}>
                  Закрыть всем
                </button>
              </div>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={enrollments.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-[var(--portal-text-muted)]">Найти в списке:</span>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-text-muted)]" />
          <Input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="ФИО или e-mail..."
            className="pl-8"
          />
        </div>
      </div>

      {selectedArr.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--portal-accent-muted)] bg-[var(--portal-accent-soft)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--portal-text)]">Выбрано: {selectedArr.length}</span>
          <Button variant="danger" size="sm" onClick={() => setBulkUnenrollConfirm(true)} disabled={bulkUnenrolling}>
            Отчислить выбранных
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Снять выбор
          </Button>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={5} cols={6} className="mt-4" />
      ) : enrollments.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="Нет участников"
          description="Добавьте пользователей через меню «Добавить» выше"
          icon={<Users className="h-10 w-10" />}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={listFiltered.length > 0 && listFiltered.every((e) => selectedIds.has(e.id))}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedArr.length > 0 && selectedArr.length < listFiltered.length;
                      return;
                    }}
                    onChange={() => (listFiltered.every((e) => selectedIds.has(e.id)) ? setSelectedIds(new Set()) : setSelectedIds(new Set(listFiltered.map((e) => e.id))))}
                    aria-label="Выбрать все на странице"
                  />
                </TableHead>
                <TableHead className="w-8">№</TableHead>
                <TableHead>Участник</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Период</TableHead>
                <TableHead>Доступ</TableHead>
                <TableHead>Завершенность</TableHead>
                <TableHead className="w-[200px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listFiltered.map((row, idx) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`Выбрать ${row.user.displayName || row.user.email}`}
                    />
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{idx + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/portal/admin/users/${row.userId}`}
                      className="font-medium text-[var(--portal-accent)] hover:underline"
                    >
                      {row.user.displayName || row.user.email || '—'}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{row.user.email ?? '—'}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)] whitespace-nowrap">
                    {formatPeriod(row.enrolledAt, row.expiresAt)}
                  </TableCell>
                  <TableCell>
                    {row.accessClosed ? (
                      <span className="text-amber-600">Закрыт</span>
                    ) : (
                      <span className="text-green-600">Открыт</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.completedAt || row.progress.percent >= 100 ? (
                      <span className="text-green-600">Завершено</span>
                    ) : (
                      <span className="text-[var(--portal-text-muted)]">Не завершено</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Link
                        href={`/portal/admin/users/${row.userId}`}
                        className="inline-flex h-8 items-center rounded px-2 text-xs text-[var(--portal-accent)] hover:bg-[#F8FAFC]"
                        title="Подробнее"
                        aria-label="Карточка участника"
                      >
                        Подробнее
                      </Link>
                      <Link
                        href={`/portal/admin/courses/${courseId}/enrollments/${row.userId}`}
                        className="inline-flex h-8 items-center rounded px-2 text-xs text-[var(--portal-accent)] hover:bg-[#F8FAFC]"
                        title="Изменить результаты"
                        aria-label="Изменить результаты прохождения"
                      >
                        Результаты
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={togglingAccess === row.id}
                        onClick={() => handleSetAccess(row.id, !row.accessClosed)}
                        title={row.accessClosed ? 'Открыть доступ' : 'Закрыть доступ'}
                        aria-label={row.accessClosed ? 'Открыть доступ' : 'Закрыть доступ'}
                      >
                        {togglingAccess === row.id ? '…' : row.accessClosed ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={togglingCompletion === row.id || (row.completedAt != null && row.progress.percent >= 100)}
                        onClick={() => handleSetCompletion(row)}
                        title="Завершить участие"
                        aria-label="Завершить участие"
                      >
                        {togglingCompletion === row.id ? '…' : <CheckCircle className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => setDeleteTarget(row)}
                        aria-label="Исключить"
                        title="Исключить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Записать пользователя на курс</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--portal-text-muted)]">Курс: {courseTitle}</p>
          <div className="space-y-2">
            <Label htmlFor="user-search">Поиск по email или имени</Label>
            <Input
              id="user-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Введите email или имя..."
            />
          </div>
          {searching && <p className="text-sm text-[var(--portal-text-muted)]">Поиск…</p>}
          {searchQ.length >= 2 && !searching && (
            <ul className="max-h-60 space-y-1 overflow-y-auto rounded border border-[#E2E8F0] p-2">
              {searchResults.length === 0 ? (
                <li className="text-sm text-[var(--portal-text-muted)]">Никого не найдено</li>
              ) : (
                searchResults.map((p) => {
                  const enrolled = alreadyEnrolledIds.has(p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded py-1.5 px-2 hover:bg-[#F8FAFC]">
                      <span className="text-sm">
                        {p.display_name || p.email}
                        {p.display_name && <span className="text-[var(--portal-text-muted)]"> ({p.email})</span>}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        disabled={enrolled || adding}
                        onClick={() => handleEnroll(p.id)}
                      >
                        {enrolled ? 'Уже записан' : 'Записать'}
                      </Button>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={listSelectOpen} onOpenChange={(open) => { setListSelectOpen(open); if (!open) { setListSelectSelectedIds(new Set()); setListSelectSearch(''); setListSelectGroupId(''); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Добавить слушателей на курс</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--portal-text-muted)]">
            Курс: {courseTitle}. Выберите группу или всех пользователей, отметьте галочками кого записать на курс, затем нажмите «Записать выбранных».
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="list-select-group">Группа</Label>
              <select
                id="list-select-group"
                value={listSelectGroupId}
                onChange={(e) => setListSelectGroupId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                <option value="">Все пользователи</option>
                {listSelectGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="list-select-search">Поиск</Label>
              <Input
                id="list-select-search"
                value={listSelectSearch}
                onChange={(e) => setListSelectSearch(e.target.value)}
                placeholder="ФИО или email..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 py-2 border-b border-[#E2E8F0]">
            <Button variant="ghost" size="sm" onClick={toggleListSelectAll}>
              {listSelectFiltered.filter((u) => !alreadyEnrolledIds.has(u.id)).every((u) => listSelectSelectedIds.has(u.id)) && listSelectFiltered.filter((u) => !alreadyEnrolledIds.has(u.id)).length > 0
                ? 'Снять выбор'
                : 'Выбрать всех'}
            </Button>
            <span className="text-sm text-[var(--portal-text-muted)]">
              Выбрано: {Array.from(listSelectSelectedIds).filter((id) => !alreadyEnrolledIds.has(id)).length}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto rounded border border-[#E2E8F0] max-h-[300px]">
            {listSelectLoading ? (
              <div className="p-4 text-center text-sm text-[var(--portal-text-muted)]">Загрузка…</div>
            ) : listSelectFiltered.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--portal-text-muted)]">Нет пользователей</div>
            ) : (
              <ul className="divide-y divide-[#E2E8F0] p-2">
                {listSelectFiltered.map((u) => {
                  const enrolled = alreadyEnrolledIds.has(u.id);
                  const selected = listSelectSelectedIds.has(u.id);
                  return (
                    <li key={u.id} className="flex items-center gap-3 py-2 px-2 hover:bg-[#F8FAFC] rounded">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          if (enrolled) return;
                          setListSelectSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id);
                            else next.add(u.id);
                            return next;
                          });
                        }}
                        disabled={enrolled}
                        aria-label={u.displayName || u.email}
                      />
                      <span className="flex-1 text-sm truncate">
                        {u.displayName || u.email}
                        {u.displayName && <span className="text-[var(--portal-text-muted)]"> ({u.email})</span>}
                        {enrolled && <span className="ml-2 text-amber-600 text-xs">Уже записан</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="ghost" onClick={() => setListSelectOpen(false)}>Отмена</Button>
            <Button
              onClick={handleListSelectEnroll}
              disabled={listSelectEnrolling || Array.from(listSelectSelectedIds).filter((id) => !alreadyEnrolledIds.has(id)).length === 0}
            >
              {listSelectEnrolling ? '…' : 'Записать выбранных'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkEnrollOpen} onOpenChange={setBulkEnrollOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Массовое зачисление</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--portal-text-muted)]">
            Введите email или ID пользователей — по одному на строку (макс. {BULK_LIMIT}). Либо загрузите CSV с колонкой email.
          </p>
          <div className="space-y-2">
            <Label htmlFor="bulk-enroll-input">Email или ID (по одному на строку)</Label>
            <textarea
              id="bulk-enroll-input"
              value={bulkEnrollText}
              onChange={(e) => setBulkEnrollText(e.target.value)}
              placeholder="user@example.com&#10;user2@example.com"
              rows={8}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkEnrollCsv}
                className="hidden"
                id="bulk-enroll-csv"
              />
              <Label htmlFor="bulk-enroll-csv" className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm hover:bg-[#F8FAFC]">
                  <Upload className="h-4 w-4" />
                  Загрузить CSV (колонка email)
                </span>
              </Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setBulkEnrollOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleBulkEnrollSubmit} disabled={bulkEnrolling || parseBulkInput(bulkEnrollText).length === 0}>
              {bulkEnrolling ? '…' : 'Записать'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={bulkUnenrollConfirm}
        onOpenChange={setBulkUnenrollConfirm}
        title="Отчислить выбранных?"
        description={`Будет отчислено пользователей: ${selectedArr.length}. Прогресс прохождения не удаляется.`}
        onConfirm={() => void handleBulkUnenroll()}
        confirmLabel="Отчислить"
        variant="danger"
        loading={bulkUnenrolling}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить запись на курс?"
        description={
          deleteTarget
            ? `Пользователь ${deleteTarget.user.displayName || deleteTarget.user.email} будет отписан от курса «${courseTitle}». Прогресс прохождения не удаляется.`
            : ''
        }
        onConfirm={() => { if (deleteTarget) void handleDelete(deleteTarget); }}
        confirmLabel="Удалить"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
