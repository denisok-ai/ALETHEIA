'use client';

/**
 * Block "Группы ресурса" for edit media dialog: list groups, add/remove.
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Folder } from 'lucide-react';

interface GroupRef {
  id: string;
  name: string;
  parentId: string | null;
}

export function MediaItemGroupsBlock({ mediaId }: { mediaId: string }) {
  const [groups, setGroups] = useState<GroupRef[]>([]);
  const [allGroups, setAllGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/admin/media/${mediaId}/groups`).then((r) => (r.ok ? r.json() : { groups: [] })),
      fetch('/api/portal/admin/groups?moduleType=media').then((r) => (r.ok ? r.json() : { groups: [] })),
    ])
      .then(([mediaGroups, all]) => {
        setGroups(mediaGroups.groups ?? []);
        setAllGroups((all.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        setSelectedGroupId('');
      })
      .finally(() => setLoading(false));
  }, [mediaId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!selectedGroupId) {
      toast.error('Выберите группу');
      return;
    }
    setAdding(true);
    try {
      const r = await fetch(`/api/portal/admin/media/${mediaId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      toast.success('Ресурс добавлен в группу');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setAdding(false);
  }

  async function handleRemove(groupId: string) {
    try {
      const r = await fetch(`/api/portal/admin/media/${mediaId}/groups?groupId=${groupId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Ресурс удалён из группы');
      load();
    } catch {
      toast.error('Ошибка удаления');
    }
  }

  const alreadyIds = new Set(groups.map((g) => g.id));
  const availableGroups = allGroups.filter((g) => !alreadyIds.has(g.id));

  if (loading) {
    return <p className="text-sm text-text-muted">Загрузка групп…</p>;
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <h4 className="text-sm font-medium text-dark">Группы ресурса</h4>
      <div className="flex flex-wrap items-end gap-2">
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm min-w-[160px]"
        >
          <option value="">— Выберите группу</option>
          {availableGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <Button type="button" size="sm" onClick={handleAdd} disabled={adding || !selectedGroupId}>
          {adding ? '…' : 'Добавить'}
        </Button>
      </div>
      {groups.length === 0 ? (
        <p className="text-xs text-text-muted flex items-center gap-1">
          <Folder className="h-3.5 w-3.5" /> Не входит ни в одну группу
        </p>
      ) : (
        <ul className="space-y-1">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between text-sm">
              <span>{g.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-red-600 hover:text-red-700 text-xs"
                onClick={() => handleRemove(g.id)}
              >
                Убрать
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
