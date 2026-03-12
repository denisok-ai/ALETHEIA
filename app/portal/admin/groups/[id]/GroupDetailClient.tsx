'use client';

/**
 * Group detail: info, edit, and composition (courses/media/users) with add/remove.
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, BookOpen, FolderOpen, Users, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GroupFormModal } from '@/components/portal/GroupFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

export interface GroupDetailGroup {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string }[];
  moduleType: string;
  type: string;
  accessType: string;
  displayOrder: number;
  childrenCount: number;
  coursesCount: number;
  mediaCount: number;
  usersCount: number;
}

interface GroupDetailClientProps {
  group: GroupDetailGroup;
}

export function GroupDetailClient({ group }: GroupDetailClientProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [courses, setCourses] = useState<{ id: string; title: string; status: string }[]>([]);
  const [media, setMedia] = useState<{ id: string; title: string; type: string; mimeType: string | null }[]>([]);
  const [users, setUsers] = useState<{ userId: string; email: string | null; displayName: string | null; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const groupId = group.id;
  const moduleType = group.moduleType as 'course' | 'media' | 'user';

  const loadItems = useCallback(() => {
    setLoading(true);
    if (moduleType === 'course') {
      fetch(`/api/portal/admin/groups/${groupId}/courses`)
        .then((r) => (r.ok ? r.json() : { courses: [] }))
        .then((d) => setCourses(d.courses ?? []))
        .finally(() => setLoading(false));
    } else if (moduleType === 'media') {
      fetch(`/api/portal/admin/groups/${groupId}/media`)
        .then((r) => (r.ok ? r.json() : { media: [] }))
        .then((d) => setMedia(d.media ?? []))
        .finally(() => setLoading(false));
    } else if (moduleType === 'user') {
      fetch(`/api/portal/admin/groups/${groupId}/users`)
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d) => setUsers(d.users ?? []))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [groupId, moduleType]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const listHref =
    moduleType === 'course'
      ? '/portal/admin/courses'
      : moduleType === 'media'
        ? '/portal/admin/media'
        : '/portal/admin/users';

  function handleEditSuccess() {
    setEditOpen(false);
    router.refresh();
  }

  async function handleDeleteGroup() {
    setDeleting(true);
    try {
      const r = await fetch(`/api/portal/admin/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteNestedItems: false }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      toast.success('Группа удалена');
      router.push(listHref);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось удалить');
    }
    setDeleting(false);
  }

  async function handleRemoveCourse(courseId: string) {
    setRemovingId(courseId);
    try {
      const r = await fetch(`/api/portal/admin/groups/${groupId}/courses?courseId=${courseId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Курс убран из группы');
      loadItems();
    } catch {
      toast.error('Не удалось убрать');
    }
    setRemovingId(null);
  }

  async function handleRemoveMedia(mediaId: string) {
    setRemovingId(mediaId);
    try {
      const r = await fetch(`/api/portal/admin/groups/${groupId}/media?mediaId=${mediaId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Ресурс убран из группы');
      loadItems();
    } catch {
      toast.error('Не удалось убрать');
    }
    setRemovingId(null);
  }

  async function handleRemoveUser(userId: string) {
    setRemovingId(userId);
    try {
      const r = await fetch(`/api/portal/admin/groups/${groupId}/users?userId=${userId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Участник убран из группы');
      loadItems();
    } catch {
      toast.error('Не удалось убрать');
    }
    setRemovingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--portal-text)] mb-2">Информация</h2>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-[var(--portal-text-muted)]">Название</dt>
            <dd className="font-medium text-[var(--portal-text)]">{group.name}</dd>
          </div>
          {group.description && (
            <div>
              <dt className="text-[var(--portal-text-muted)]">Описание</dt>
              <dd className="text-[var(--portal-text)]">{group.description}</dd>
            </div>
          )}
          {group.parent && (
            <div>
              <dt className="text-[var(--portal-text-muted)]">Родительская группа</dt>
              <dd>
                <Link href={`/portal/admin/groups/${group.parent.id}`} className="text-[#6366F1] hover:underline">
                  {group.parent.name}
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[var(--portal-text-muted)]">Тип</dt>
            <dd className="text-[var(--portal-text)]">{group.type === 'dynamic' ? 'Динамическая' : 'Статическая'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Редактировать
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Удалить группу
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Удалить группу?"
        description={`Группа «${group.name}» будет удалена. Дочерние группы будут отвязаны (станут корневыми). Связи с элементами (курсы/медиа/пользователи) будут сняты.`}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={handleDeleteGroup}
        loading={deleting}
      />

      {(group.children ?? []).length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <h2 className="text-sm font-semibold text-[var(--portal-text)] flex items-center gap-2 mb-3">
            <FolderTree className="h-4 w-4" />
            Дочерние группы
          </h2>
          <ul className="space-y-1">
            {(group.children ?? []).map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/portal/admin/groups/${ch.id}`}
                  className="text-[#6366F1] hover:underline text-sm"
                >
                  {ch.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-[var(--portal-text)] flex items-center gap-2">
            {moduleType === 'course' && <BookOpen className="h-4 w-4" />}
            {moduleType === 'media' && <FolderOpen className="h-4 w-4" />}
            {moduleType === 'user' && <Users className="h-4 w-4" />}
            {moduleType === 'course' && 'Курсы в группе'}
            {moduleType === 'media' && 'Ресурсы в группе'}
            {moduleType === 'user' && 'Участники группы'}
          </h2>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>

        {moduleType === 'course' && (
          <>
            {loading ? (
              <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
            ) : courses.length === 0 ? (
              <EmptyState
                title="Нет курсов"
                description="Добавьте курсы в группу кнопкой выше"
                icon={<BookOpen className="h-10 w-10" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/portal/admin/courses/${c.id}`} className="text-[#6366F1] hover:underline">
                          {c.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[var(--portal-text-muted)]">{c.status}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={removingId === c.id}
                          onClick={() => handleRemoveCourse(c.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {moduleType === 'media' && (
          <>
            {loading ? (
              <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
            ) : media.length === 0 ? (
              <EmptyState
                title="Нет ресурсов"
                description="Добавьте ресурсы медиатеки в группу"
                icon={<FolderOpen className="h-10 w-10" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {media.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Link href={`/portal/admin/media`} className="text-[#6366F1] hover:underline">
                          {m.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[var(--portal-text-muted)]">{m.type ?? '—'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={removingId === m.id}
                          onClick={() => handleRemoveMedia(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {moduleType === 'user' && (
          <>
            {loading ? (
              <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
            ) : users.length === 0 ? (
              <EmptyState
                title="Нет участников"
                description="Добавьте пользователей в группу"
                icon={<Users className="h-10 w-10" />}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль в группе</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell>
                        <Link href={`/portal/admin/users/${u.userId}`} className="text-[#6366F1] hover:underline">
                          {u.displayName ?? u.email ?? u.userId}
                        </Link>
                      </TableCell>
                      <TableCell className="text-[var(--portal-text-muted)]">{u.email ?? '—'}</TableCell>
                      <TableCell className="text-[var(--portal-text-muted)]">{u.role === 'moderator' ? 'Модератор' : 'Участник'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          disabled={removingId === u.userId}
                          onClick={() => handleRemoveUser(u.userId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </div>

      <GroupFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        moduleType={moduleType}
        parentId={group.parentId}
        editId={group.id}
        onSuccess={handleEditSuccess}
      />

      <AddToGroupModal
        open={addOpen}
        onOpenChange={setAddOpen}
        groupId={groupId}
        moduleType={moduleType}
        onAdded={loadItems}
        adding={adding}
        setAdding={setAdding}
      />
    </div>
  );
}

interface AddToGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  moduleType: 'course' | 'media' | 'user';
  onAdded: () => void;
  adding: boolean;
  setAdding: (v: boolean) => void;
}

function AddToGroupModal({
  open,
  onOpenChange,
  groupId,
  moduleType,
  onAdded,
  adding,
  setAdding,
}: AddToGroupModalProps) {
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [media, setMedia] = useState<{ id: string; title: string; type: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string | null; displayName: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setLoading(true);
    if (moduleType === 'course') {
      fetch('/api/portal/admin/courses')
        .then((r) => (r.ok ? r.json() : { courses: [] }))
        .then((d) => setCourses(d.courses ?? []))
        .finally(() => setLoading(false));
    } else if (moduleType === 'media') {
      fetch('/api/portal/admin/media')
        .then((r) => (r.ok ? r.json() : { media: [] }))
        .then((d) => setMedia(d.media ?? []))
        .finally(() => setLoading(false));
    } else {
      fetch('/api/portal/admin/comms/recipients')
        .then((r) => (r.ok ? r.json() : { users: [] }))
        .then((d) => setUsers(d.users ?? []))
        .finally(() => setLoading(false));
    }
  }, [open, moduleType]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      let added = 0;
      for (const id of Array.from(selectedIds)) {
        const r =
          moduleType === 'course'
            ? await fetch(`/api/portal/admin/groups/${groupId}/courses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId: id }),
              })
            : moduleType === 'media'
              ? await fetch(`/api/portal/admin/groups/${groupId}/media`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mediaId: id }),
                })
              : await fetch(`/api/portal/admin/groups/${groupId}/users`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId: id, role: 'member' }),
                });
        if (r.ok) added++;
      }
      toast.success(`Добавлено: ${added}`);
      onAdded();
      onOpenChange(false);
    } catch {
      toast.error('Ошибка при добавлении');
    }
    setAdding(false);
  }

  const title =
    moduleType === 'course' ? 'Добавить курсы в группу' : moduleType === 'media' ? 'Добавить ресурсы в группу' : 'Добавить участников в группу';
  const list =
    moduleType === 'course'
      ? courses
      : moduleType === 'media'
        ? media
        : users.map((u) => ({ id: u.id, title: u.displayName ?? u.email ?? u.id }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded border border-[#E2E8F0] p-2 space-y-1">
            {list.length === 0 ? (
              <p className="text-sm text-[var(--portal-text-muted)]">Нет элементов для добавления</p>
            ) : (
              list.map((item) => (
                <label key={item.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  <span className="truncate">{item.title}</span>
                </label>
              ))
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleAdd} disabled={adding || selectedIds.size === 0}>
            {adding ? 'Добавление…' : `Добавить (${selectedIds.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
