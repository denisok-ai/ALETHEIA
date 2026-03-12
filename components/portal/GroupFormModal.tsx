'use client';

/**
 * Modal for creating or editing a group (Courses, Media, Users).
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface GroupFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleType: 'course' | 'media' | 'user';
  parentId: string | null;
  editId: string | null;
  onSuccess: () => void;
}

interface FlatGroup {
  id: string;
  name: string;
  parentId: string | null;
}

export function GroupFormModal({
  open,
  onOpenChange,
  moduleType,
  parentId,
  editId,
  onSuccess,
}: GroupFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'static' | 'dynamic'>('static');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentId);
  const [groups, setGroups] = useState<FlatGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && moduleType) {
      setSelectedParentId(parentId);
      fetch(`/api/portal/admin/groups?moduleType=${moduleType}`)
        .then((r) => (r.ok ? r.json() : { groups: [] }))
        .then((d) => setGroups(d.groups ?? []));
    }
  }, [open, moduleType, parentId]);

  useEffect(() => {
    if (open && editId) {
      setLoading(true);
      fetch(`/api/portal/admin/groups/${editId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((g) => {
          if (g) {
            setName(g.name ?? '');
            setDescription(g.description ?? '');
            setType(g.type ?? 'static');
            setSelectedParentId(g.parentId ?? null);
          }
        })
        .finally(() => setLoading(false));
    } else if (open && !editId) {
      setName('');
      setDescription('');
      setType('static');
      setSelectedParentId(parentId);
    }
  }, [open, editId, parentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      const body = {
        name: trimmedName,
        description: description.trim() || null,
        parentId: selectedParentId,
        moduleType,
        type,
        accessType: 'common',
      };
      const url = editId
        ? `/api/portal/admin/groups/${editId}`
        : '/api/portal/admin/groups';
      const method = editId ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
    setSaving(false);
  }

  const parentOptions = groups.filter((g) => !editId || g.id !== editId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editId ? 'Редактировать группу' : 'Новая группа'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-[var(--portal-text-muted)]">Загрузка…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="group-name">Название</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название группы"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="group-parent">Родительская группа</Label>
              <select
                id="group-parent"
                value={selectedParentId ?? ''}
                onChange={(e) => setSelectedParentId(e.target.value || null)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] focus:ring-2 focus:ring-[#6366F1] bg-white px-3 py-2 text-sm"
              >
                <option value="">— Без родителя (корневая)</option>
                {parentOptions.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="group-desc">Описание</Label>
              <textarea
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] focus:ring-2 focus:ring-[#6366F1] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>Тип</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'static' | 'dynamic')}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] focus:ring-2 focus:ring-[#6366F1] bg-white px-3 py-2 text-sm"
              >
                <option value="static">Статическая</option>
                <option value="dynamic">Динамическая</option>
              </select>
              <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                Статическая — ручное назначение; динамическая — может обновляться системой.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохранение…' : editId ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
