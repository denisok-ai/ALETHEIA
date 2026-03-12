'use client';

/**
 * Admin courses: table + create form + SCORM upload, edit, delete, status toggle, reorder.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Upload, Pencil, Trash2, ChevronUp, ChevronDown, ExternalLink, Copy, CheckSquare, Square, FolderPlus, FolderMinus } from 'lucide-react';
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
import { COURSE_STATUS_OPTIONS, getCourseStatusLabel, type CourseStatusKey } from '@/lib/course-status';

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
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [reordering, setReordering] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);

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
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
      setNewStartsAt('');
      setNewEndsAt('');
      setNewStatus('published');
      setNewPrice('');
    } catch (err) {
      console.error(err);
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
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { scormPath?: string };
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, scorm_path: data.scormPath ?? c.scorm_path } : c
        )
      );
      toast.success('SCORM-пакет загружен');
    } catch (err) {
      console.error(err);
      toast.error('Ошибка загрузки');
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
              <Label htmlFor="desc">Описание</Label>
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
            <div className="flex gap-2">
              <Button type="submit" disabled={creating}>
                {creating ? 'Создание…' : 'Создать'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
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
                  {selectedIds.size >= courses.length && courses.length > 0 ? <CheckSquare className="h-4 w-4 text-[#6366F1]" /> : <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />}
                </button>
              </th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)] w-8">↑↓</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Название</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Начало</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Окончание</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Статус</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Цена</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">SCORM</th>
              <th className="px-4 py-2 font-medium text-[var(--portal-text)]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {[...courses].sort((a, b) => a.sort_order - b.sort_order).map((c) => (
              <tr key={c.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]">
                <td className="px-2 py-2">
                  <button type="button" onClick={() => toggleSelect(c.id)} className="p-1">
                    {selectedIds.has(c.id) ? <CheckSquare className="h-4 w-4 text-[#6366F1]" /> : <Square className="h-4 w-4 text-[var(--portal-text-muted)]" />}
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
                <td className="px-4 py-2">
                  <Link
                    href={`/portal/admin/courses/${c.id}`}
                    className="font-medium text-[#6366F1] hover:underline"
                  >
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--portal-text-muted)] whitespace-nowrap">
                  {c.starts_at ? formatDateTime(c.starts_at) : '—'}
                </td>
                <td className="px-4 py-2 text-[var(--portal-text-muted)] whitespace-nowrap">
                  {c.ends_at ? formatDateTime(c.ends_at) : '—'}
                </td>
                <td className="px-4 py-2 text-[var(--portal-text-muted)]">{getCourseStatusLabel(c.status)}</td>
                <td className="px-4 py-2 text-[var(--portal-text-muted)]">{c.price != null ? `${c.price} ₽` : '—'}</td>
                <td className="px-4 py-2 text-[var(--portal-text-muted)]">{c.scorm_path ? 'Загружен' : '—'}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {c.scorm_path && (
                      <Link
                        href={`/portal/student/courses/${c.id}/play`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--portal-text-muted)] hover:bg-[#F8FAFC] hover:text-[#6366F1]"
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
            ))}
          </tbody>
        </table>
      </div>
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
            <Label htmlFor="edit-desc">Описание</Label>
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
