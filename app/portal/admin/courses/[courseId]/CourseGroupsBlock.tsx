'use client';

/**
 * Tab "Группы": список групп, в которых состоит курс; добавление/удаление привязки.
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Folder } from 'lucide-react';

interface GroupRef {
  id: string;
  name: string;
  parentId: string | null;
}

export function CourseGroupsBlock({ courseId }: { courseId: string }) {
  const [groups, setGroups] = useState<GroupRef[]>([]);
  const [allGroups, setAllGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  function load() {
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/admin/courses/${courseId}/groups`).then((r) => (r.ok ? r.json() : { groups: [] })),
      fetch('/api/portal/admin/groups?moduleType=course').then((r) => (r.ok ? r.json() : { groups: [] })),
    ])
      .then(([courseGroups, all]) => {
        setGroups(courseGroups.groups ?? []);
        setAllGroups((all.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        setSelectedGroupId('');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/admin/courses/${courseId}/groups`).then((r) => (r.ok ? r.json() : { groups: [] })),
      fetch('/api/portal/admin/groups?moduleType=course').then((r) => (r.ok ? r.json() : { groups: [] })),
    ])
      .then(([courseGroups, all]) => {
        setGroups(courseGroups.groups ?? []);
        setAllGroups((all.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        setSelectedGroupId('');
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  async function handleAdd() {
    if (!selectedGroupId) {
      toast.error('Выберите группу');
      return;
    }
    setAdding(true);
    try {
      const r = await fetch(`/api/portal/admin/courses/${courseId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      toast.success('Курс добавлен в группу');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setAdding(false);
  }

  async function handleRemove(groupId: string) {
    try {
      const r = await fetch(`/api/portal/admin/courses/${courseId}/groups?groupId=${groupId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Курс удалён из группы');
      load();
    } catch {
      toast.error('Ошибка удаления');
    }
  }

  const alreadyIds = new Set(groups.map((g) => g.id));
  const availableGroups = allGroups.filter((g) => !alreadyIds.has(g.id));

  if (loading) {
    return (
      <Card>
        <p className="text-text-muted">Загрузка…</p>
      </Card>
    );
  }

  return (
    <Card title="Группы курса" description="Курс может входить в несколько групп для структуры каталога.">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-dark mb-1">Добавить в группу</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
            >
              <option value="">— Выберите группу</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleAdd} disabled={adding || !selectedGroupId}>
            {adding ? 'Добавление…' : 'Добавить'}
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            title="Курс не входит ни в одну группу"
            description="Добавьте курс в группу для структурирования каталога."
            icon={<Folder className="h-10 w-10" />}
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-3 py-2">
                <span className="font-medium text-dark">{g.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleRemove(g.id)}
                >
                  Удалить из группы
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
