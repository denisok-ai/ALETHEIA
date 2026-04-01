'use client';

/**
 * Admin courses: table + create form + SCORM upload, edit, delete, status toggle, reorder, column sort.
 */
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Upload, Pencil, Trash2, ChevronUp, ChevronDown, ArrowUpDown, ExternalLink, Copy, CheckSquare, Square, FolderPlus, FolderMinus, Sparkles } from 'lucide-react';
import { sortTableBy, type SortDir } from '@/lib/table-sort';
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
import { EmptyState } from '@/components/ui/EmptyState';
import { GroupPickerModal } from '@/components/portal/GroupPickerModal';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { COURSE_STATUS_OPTIONS, getCourseStatusLabel, type CourseStatusKey } from '@/lib/course-status';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';

const COURSES_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'title', label: 'Название' },
  { id: 'starts_at', label: 'Начало' },
  { id: 'ends_at', label: 'Окончание' },
  { id: 'status', label: 'Статус' },
  { id: 'price', label: 'Цена' },
  { id: 'scorm', label: 'SCORM' },
];

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  scorm_path: string | null;
  thumbnail_url: string | null;
  status: string;
  price: number | null;
  sort_order: number;
  created_at: string;
}

interface CoursesAdminClientProps {
  initialCourses: Course[];
  selectedGroupId?: string | null;
  onGroupsChanged?: () => void;
}

export function CoursesAdminClient({ initialCourses, selectedGroupId = null, onGroupsChanged }: CoursesAdminClientProps) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newEndsAt, setNewEndsAt] = useState('');
  const [newStatus, setNewStatus] = useState<CourseStatusKey>('published');
  const [newPrice, setNewPrice] = useState('');
  const [newScormFile, setNewScormFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => COURSES_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleExportExcel = () => {
    const headers = ['Название', 'Начало', 'Окончание', 'Статус', 'Цена', 'SCORM'];
    const rows = sortedCourses.map((c) => [
      c.title,
      c.starts_at ? formatDateTime(c.starts_at) : '—',
      c.ends_at ? formatDateTime(c.ends_at) : '—',
      getCourseStatusLabel(c.status),
      c.price != null ? `${c.price}` : '—',
      c.scorm_path ? 'Загружен' : '—',
    ]);
    downloadXlsxFromArrays(headers, rows, `courses-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const courseSortGetters: Record<string, (c: Course) => unknown> = {
    title: (c) => c.title,
    starts_at: (c) => c.starts_at ?? '',
    ends_at: (c) => c.ends_at ?? '',
    status: (c) => c.status,
    price: (c) => c.price ?? -1,
    scorm: (c) => (c.scorm_path ? 1 : 0),
  };
  const sortedCourses = useMemo(() => {
    if (!sortKey || !courseSortGetters[sortKey]) {
      return [...courses].sort((a, b) => a.sort_order - b.sort_order);
    }
    return sortTableBy(courses, courseSortGetters[sortKey], sortDir);
  }, [courses, sortKey, sortDir]);

  async function handleDuplicate(c: Course) {
    setDuplicating(c.id);
    try {
      const res = await fetch('/api/portal/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${c.title} (копия)`,
          description: c.description,
          startsAt: c.starts_at,
          endsAt: c.ends_at,
          status: 'draft',
          price: c.price,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { course: Course & { sort_order?: number } };
      const newCourse: Course = {
        id: data.course.id,
        title: data.course.title,
        description: data.course.description ?? null,
        starts_at: data.course.starts_at ?? null,
        ends_at: data.course.ends_at ?? null,
        scorm_path: null,
        thumbnail_url: null,
        status: 'draft',
        price: data.course.price ?? null,
        sort_order: data.course.sort_order ?? courses.length,
        created_at: data.course.created_at ?? new Date().toISOString(),
      };
      setCourses((prev) => [...prev, newCourse].sort((a, b) => a.sort_order - b.sort_order));
      toast.success('Курс скопирован');
      router.push(`/portal/admin/courses/${data.course.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка копирования');
    }
    setDuplicating(null);
  }

  async function handleBulkStatus(status: CourseStatusKey) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkUpdating(true);
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/portal/admin/courses/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          setCourses((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
          ok++;
        }
      } catch (_) {}
    }
    setSelectedIds(new Set());
    setBulkUpdating(false);
    toast.success(ok === ids.length ? `Статус обновлён у ${ok} курсов` : `Обновлено ${ok} из ${ids.length}`);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const sorted = [...courses].sort((a, b) => a.sort_order - b.sort_order);
    if (selectedIds.size >= sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((c) => c.id)));
  }

  async function handleBulkAddToGroup(groupId: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setGroupActionLoading(true);
    let ok = 0;
    for (const courseId of ids) {
      try {
        const r = await fetch(`/api/portal/admin/groups/${groupId}/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });
        if (r.ok) ok++;
      } catch (_) {}
    }
    setGroupActionLoading(false);
    setGroupPickerOpen(false);
    setSelectedIds(new Set());
    onGroupsChanged?.();
    toast.success(ok === ids.length ? `Добавлено в группу: ${ok} курсов` : `Добавлено ${ok} из ${ids.length}`);
  }

  async function handleBulkRemoveFromGroup() {
    if (!selectedGroupId) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setGroupActionLoading(true);
    let ok = 0;
    for (const courseId of ids) {
      try {
        const r = await fetch(`/api/portal/admin/courses/${courseId}/groups?groupId=${selectedGroupId}`, { method: 'DELETE' });
        if (r.ok) ok++;
      } catch (_) {}
    }
    setGroupActionLoading(false);
    setSelectedIds(new Set());
    onGroupsChanged?.();
    toast.success(ok === ids.length ? `Исключено из группы: ${ok} курсов` : `Исключено ${ok} из ${ids.length}`);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/portal/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || null,
          startsAt: newStartsAt || null,
          endsAt: newEndsAt || null,
          status: newStatus,
          price: newPrice ? parseInt(newPrice, 10) : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const newCourse: Course = {
        id: data.course.id,
        title: data.course.title,
        description: data.course.description ?? null,
        starts_at: data.course.starts_at ?? null,
        ends_at: data.course.ends_at ?? null,
        scorm_path: data.course.scorm_path ?? null,
        thumbnail_url: data.course.thumbnail_url ?? null,
        status: data.course.status ?? 'draft',
        price: data.course.price ?? null,
        sort_order: data.course.sort_order ?? courses.length,
        created_at: data.course.created_at ?? new Date().toISOString(),
      };
      setCourses((prev) => [newCourse, ...prev]);
      if (newScormFile) {
        await handleUpload(newCourse.id, newScormFile);
      }
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewStartsAt('');
      setNewEndsAt('');
      setNewStatus('published');
      setNewPrice('');
      setNewScormFile(null);
      toast.success(newScormFile ? 'Курс создан, SCORM загружен' : 'Курс создан');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка создания курса');
    }
    setCreating(false);
  }

  async function handleUpload(courseId: string, file: File) {
    setUploading(courseId);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('courseId', courseId);
      const res = await fetch('/api/portal/admin/courses/upload', { method: 'POST', body: form });
      let data: { success?: boolean; scormPath?: string; error?: string };
      try {
        data = (await res.json()) as { success?: boolean; scormPath?: string; error?: string };
      } catch {
        throw new Error(res.ok ? 'Неверный ответ сервера' : `Ошибка ${res.status}`);
      }
      if (!res.ok) throw new Error(data.error ?? `Ошибка ${res.status}`);
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, scorm_path: data.scormPath ?? c.scorm_path } : c
        )
      );
      toast.success('SCORM-пакет загружен');
    } catch (err) {
      console.error('SCORM upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Ошибка загрузки SCORM');
    }
    setUploading(null);
  }

  async function handleUpdate(courseId: string, data: { title?: string; description?: string | null; startsAt?: string | null; endsAt?: string | null; price?: number | null; status?: string; thumbnailUrl?: string | null }) {
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { course: Course };
      setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, ...json.course } : c)));
      setEditing(null);
      toast.success('Курс обновлён');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка обновления');
    }
  }

  async function handleDelete(course: Course) {
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/portal/admin/courses/${course.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      toast.success('Курс удалён');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка удаления');
    }
  }

  async function handleStatusChange(c: Course, status: CourseStatusKey) {
    try {
      const res = await fetch(`/api/portal/admin/courses/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCourses((prev) => prev.map((x) => (x.id === c.id ? { ...x, status } : x)));
      toast.success('Статус обновлён');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка');
    }
  }

  async function handleReorder(indexDelta: number, course: Course) {
    const sorted = [...courses].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === course.id);
    if (idx < 0) return;
    const newIdx = idx + indexDelta;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const swapped = [...sorted];
    [swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]];
    const courseIds = swapped.map((x) => x.id);
    setReordering(course.id);
    try {
      const res = await fetch('/api/portal/admin/courses/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCourses((prev) => {
        const next = [...prev];
        swapped.forEach((c, i) => {
          const found = next.find((x) => x.id === c.id);
          if (found) found.sort_order = i;
        });
        return next.sort((a, b) => a.sort_order - b.sort_order);
      });
      toast.success('Порядок обновлён');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка');
    }
    setReordering(null);
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setShowCreate((v) => !v)} variant="secondary">
          <Plus className="mr-2 h-4 w-4" />
          Создать курс
        </Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-[#E2E8F0] bg-white p-6"
        >
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Новый курс</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="desc">Описание</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={async () => {
                    if (!newTitle.trim()) { toast.error('Введите название курса'); return; }
                    try {
                      const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          instruction: 'Сгенерируй краткое описание курса (2-4 предложения) для лендинга. Только текст, без заголовков.',
                          context: `Название курса: ${newTitle}`,
                          maxTokens: 300,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
                      setNewDesc(data.content ?? '');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Не удалось сгенерировать');
                    }
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> AI описание
                </Button>
              </div>
              <textarea
                id="desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-4 py-2"
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="startsAt">Начало</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="endsAt">Окончание</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={newEndsAt}
                  onChange={(e) => setNewEndsAt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="newStatus">Статус</Label>
              <select
                id="newStatus"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as CourseStatusKey)}
                className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                {COURSE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="price">Цена (₽)</Label>
              <Input
                id="price"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="newScorm">SCORM-пакет (ZIP)</Label>
              <Input
                id="newScorm"
                type="file"
                accept=".zip"
                onChange={(e) => setNewScormFile(e.target.files?.[0] ?? null)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">Можно загрузить SCORM после создания курса или сейчас.</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={creating}>
                {creating ? (newScormFile ? 'Создание и загрузка…' : 'Создание…') : 'Создать'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); setNewScormFile(null); }}>
                Отмена
              </Button>
            </div>
          </div>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--portal-accent-muted)] bg-[var(--portal-accent-soft)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--portal-text)]">Выбрано: {selectedIds.size}</span>
          <span className="text-sm text-[var(--portal-text-muted)]">Установить статус:</span>
          {COURSE_STATUS_OPTIONS.map((o) => (
            <Button key={o.value} size="sm" variant="secondary" disabled={bulkUpdating} onClick={() => handleBulkStatus(o.value)}>
              {o.label}
            </Button>
          ))}
          <span className="text-sm text-[var(--portal-text-muted)] ml-2">Группы:</span>
          <Button size="sm" variant="secondary" disabled={groupActionLoading} onClick={() => setGroupPickerOpen(true)}>
            <FolderPlus className="h-3.5 w-3.5 mr-1" />
            Добавить в группу
          </Button>
          {selectedGroupId && (
            <Button size="sm" variant="secondary" disabled={groupActionLoading} onClick={() => handleBulkRemoveFromGroup()}>
              <FolderMinus className="h-3.5 w-3.5 mr-1" />
              Исключить из группы
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Снять выбор
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="w-10 px-2 py-2">
                <button type="button" onClick={toggleSelectAll} className="p-1" title={selectedIds.size >= courses.length ? 'Снять выбор' : 'Выбрать все'}>
                  {selectedIds.size >= courses.length && courses.length > 0 ? <CheckSquare className="h-4 w-4 text-[var(--portal-accent)]" /> : <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />}
                </button>
              </th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)] w-8">↑↓</th>
              {visibleColumnIds.includes('title') && (
                <th scope="col" className="px-4 py-2 font-medium text-[var(--portal-text)]">
                  <button type="button" onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 text-left hover:text-[var(--portal-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-1 rounded px-1 -mx-1 cursor-pointer">
                    Название
                    {sortKey === 'title' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4 text-[var(--portal-accent)]" /> : <ChevronDown className="h-4 w-4 text-[var(--portal-accent)]" />) : <ArrowUpDown className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />}
                  </button>
                </th>
              )}
              {visibleColumnIds.includes('starts_at') && (
                <th scope="col" className="px-4 py-2 font-medium text-[var(--portal-text)]">
                  <button type="button" onClick={() => handleSort('starts_at')} className="inline-flex items-center gap-1.5 text-left hover:text-[var(--portal-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-1 rounded px-1 -mx-1 cursor-pointer">
                    Начало
                    {sortKey === 'starts_at' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4 text-[var(--portal-accent)]" /> : <ChevronDown className="h-4 w-4 text-[var(--portal-accent)]" />) : <ArrowUpDown className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />}
                  </button>
                </th>
              )}
              {visibleColumnIds.includes('ends_at') && (
                <th scope="col" className="px-4 py-2 font-medium text-[var(--portal-text)]">
                  <button type="button" onClick={() => handleSort('ends_at')} className="inline-flex items-center gap-1.5 text-left hover:text-[var(--portal-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-1 rounded px-1 -mx-1 cursor-pointer">
                    Окончание
                    {sortKey === 'ends_at' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4 text-[var(--portal-accent)]" /> : <ChevronDown className="h-4 w-4 text-[var(--portal-accent)]" />) : <ArrowUpDown className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />}
                  </button>
                </th>
              )}
              {visibleColumnIds.includes('status') && (
                <th scope="col" className="px-4 py-2 font-medium text-[var(--portal-text)]">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 text-left hover:text-[var(--portal-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-1 rounded px-1 -mx-1 cursor-pointer">
                    Статус
                    {sortKey === 'status' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4 text-[var(--portal-accent)]" /> : <ChevronDown className="h-4 w-4 text-[var(--portal-accent)]" />) : <ArrowUpDown className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />}
                  </button>
                </th>
              )}
              {visibleColumnIds.includes('price') && (
                <th scope="col" className="px-4 py-2 font-medium text-[var(--portal-text)]">
                  <button type="button" onClick={() => handleSort('price')} className="inline-flex items-center gap-1.5 text-left hover:text-[var(--portal-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-1 rounded px-1 -mx-1 cursor-pointer">
                    Цена
                    {sortKey === 'price' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4 text-[var(--portal-accent)]" /> : <ChevronDown className="h-4 w-4 text-[var(--portal-accent)]" />) : <ArrowUpDown className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />}
                  </button>
                </th>
              )}
              {visibleColumnIds.includes('scorm') && (
                <th scope="col" className="px-4 py-2 font-medium text-[var(--portal-text)]">
                  <button type="button" onClick={() => handleSort('scorm')} className="inline-flex items-center gap-1.5 text-left hover:text-[var(--portal-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)] focus:ring-offset-1 rounded px-1 -mx-1 cursor-pointer">
                    SCORM
                    {sortKey === 'scorm' ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4 text-[var(--portal-accent)]" /> : <ChevronDown className="h-4 w-4 text-[var(--portal-accent)]" />) : <ArrowUpDown className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />}
                  </button>
                </th>
              )}
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const total = sortedCourses.length;
              const totalPages = Math.max(1, Math.ceil(total / pageSize));
              const currentPage = Math.min(page, totalPages - 1);
              const pageCourses = sortedCourses.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
              return pageCourses.map((c) => (
              <tr key={c.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                <td className="px-2 py-2">
                  <button type="button" onClick={() => toggleSelect(c.id)} className="p-1">
                    {selectedIds.has(c.id) ? <CheckSquare className="h-4 w-4 text-[var(--portal-accent)]" /> : <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />}
                  </button>
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-0">
                    <button
                      type="button"
                      onClick={() => handleReorder(-1, c)}
                      disabled={reordering === c.id}
                      className="p-0.5 text-[var(--portal-text-muted)] hover:text-[var(--portal-text)] disabled:opacity-50"
                      aria-label="Поднять"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(1, c)}
                      disabled={reordering === c.id}
                      className="p-0.5 text-[var(--portal-text-muted)] hover:text-[var(--portal-text)] disabled:opacity-50"
                      aria-label="Опустить"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                {visibleColumnIds.includes('title') && (
                  <td className="px-4 py-2">
                    <Link
                      href={`/portal/admin/courses/${c.id}`}
                      className="font-medium text-[var(--portal-accent)] hover:underline"
                    >
                      {c.title}
                    </Link>
                  </td>
                )}
                {visibleColumnIds.includes('starts_at') && (
                  <td className="px-4 py-2 text-[var(--portal-text-muted)] whitespace-nowrap">
                    {c.starts_at ? formatDateTime(c.starts_at) : '—'}
                  </td>
                )}
                {visibleColumnIds.includes('ends_at') && (
                  <td className="px-4 py-2 text-[var(--portal-text-muted)] whitespace-nowrap">
                    {c.ends_at ? formatDateTime(c.ends_at) : '—'}
                  </td>
                )}
                {visibleColumnIds.includes('status') && (
                  <td className="px-4 py-2 text-[var(--portal-text-muted)]">{getCourseStatusLabel(c.status)}</td>
                )}
                {visibleColumnIds.includes('price') && (
                  <td className="px-4 py-2 text-[var(--portal-text-muted)]">{c.price != null ? `${c.price} ₽` : '—'}</td>
                )}
                {visibleColumnIds.includes('scorm') && (
                  <td className="px-4 py-2 text-[var(--portal-text-muted)]">{c.scorm_path ? 'Загружен' : '—'}</td>
                )}
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.scorm_path && (
                      <Link
                        href={`/portal/student/courses/${c.id}/play`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--portal-text-muted)] hover:bg-[#F8FAFC] hover:text-[var(--portal-accent)]"
                        title="Просмотр SCORM-курса"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDuplicate(c)}
                      disabled={duplicating === c.id}
                      aria-label="Дублировать"
                      title="Дублировать курс"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setEditing(c)}
                      aria-label="Редактировать"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(c)}
                      aria-label="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c, e.target.value as CourseStatusKey)}
                      className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-xs"
                      title="Изменить статус"
                    >
                      {COURSE_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept=".zip"
                        className="hidden"
                        disabled={!!uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpload(c.id, f);
                          e.target.value = '';
                        }}
                      />
                      <span className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-xs hover:bg-[#F8FAFC]">
                        <Upload className="h-3 w-3" />
                        {uploading === c.id ? '…' : 'ZIP'}
                      </span>
                    </label>
                  </div>
                </td>
              </tr>
            ));
            })()}
          </tbody>
        </table>
      </div>
      {sortedCourses.length > 0 && (
          <TablePagination
            currentPage={Math.min(page, Math.max(0, Math.ceil(sortedCourses.length / pageSize) - 1))}
            totalPages={Math.max(1, Math.ceil(sortedCourses.length / pageSize))}
            total={sortedCourses.length}
            pageSize={pageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            columnConfig={COURSES_TABLE_COLUMNS}
            visibleColumnIds={visibleColumnIds}
            onVisibleColumnIdsChange={setVisibleColumnIds}
            onExportExcel={handleExportExcel}
            exportLabel="Excel"
          />
      )}
      {courses.length === 0 && (
        <EmptyState
          className="mt-6"
          title="Нет курсов"
          description="Создайте первый курс или загрузите SCORM-пакет"
          icon={<Plus className="h-10 w-10" />}
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Создать курс
            </Button>
          }
        />
      )}

      {editing && (
        <EditCourseDialog
          course={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            handleUpdate(editing.id, data);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Подтверждение"
        description={deleteTarget ? `В случае удаления курса «${deleteTarget.title}» будут безвозвратно удалены все связанные данные (записи на курс, прогресс, сертификаты по курсу и т.д.). Уверены, что хотите продолжить?` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
      />
      <GroupPickerModal
        open={groupPickerOpen}
        onOpenChange={setGroupPickerOpen}
        moduleType="course"
        onSelect={handleBulkAddToGroup}
        title="Добавить выбранные курсы в группу"
        confirmLabel="Добавить"
      />
    </div>
  );
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  } catch {
    return '';
  }
}

function EditCourseDialog({
  course,
  onClose,
  onSave,
}: {
  course: Course;
  onClose: () => void;
  onSave: (data: { title: string; description: string | null; startsAt: string | null; endsAt: string | null; price: number | null; status: string; thumbnailUrl: string | null }) => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? '');
  const [aiLoading, setAiLoading] = useState(false);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(course.starts_at));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(course.ends_at));
  const [price, setPrice] = useState(course.price ?? '');
  const [status, setStatus] = useState(course.status);
  const [thumbnailUrl, setThumbnailUrl] = useState(course.thumbnail_url ?? '');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Редактировать курс</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="edit-title">Название</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="edit-desc">Описание</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                disabled={aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  try {
                    const res = await fetch('/api/portal/admin/ai-settings/generate-text', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        instruction: 'Сгенерируй краткое описание курса (2-4 предложения) для лендинга. Только текст, без заголовков.',
                        context: `Название курса: ${title}`,
                        maxTokens: 300,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? 'Ошибка');
                    setDescription(data.content ?? '');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Не удалось сгенерировать');
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? 'Генерация…' : 'AI описание'}
              </Button>
            </div>
            <textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] px-4 py-2"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-startsAt">Начало</Label>
              <Input
                id="edit-startsAt"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-endsAt">Окончание</Label>
              <Input
                id="edit-endsAt"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-price">Цена (₽)</Label>
            <Input
              id="edit-price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-status">Статус</Label>
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
            >
              {COURSE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="edit-thumb">URL превью</Label>
            <Input
              id="edit-thumb"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="/uploads/..."
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() =>
                onSave({
                  title,
                  description: description || null,
                  startsAt: startsAt || null,
                  endsAt: endsAt || null,
                  price: price === '' ? null : typeof price === 'number' ? price : parseInt(String(price), 10),
                  status,
                  thumbnailUrl: thumbnailUrl || null,
                })
              }
            >
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
