'use client';

/**
 * Tab "Группы": список групп пользователя с ролью; добавление/удаление.
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/portal/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';

interface GroupRef {
  id: string;
  name: string;
  parentId: string | null;
  role: string;
}

export function UserGroupsBlock({ userId }: { userId: string }) {
  const [groups, setGroups] = useState<GroupRef[]>([]);
  const [allGroups, setAllGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'moderator'>('member');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/portal/admin/users/${userId}/groups`).then((r) => (r.ok ? r.json() : { groups: [] })),
      fetch('/api/portal/admin/groups?moduleType=user').then((r) => (r.ok ? r.json() : { groups: [] })),
    ])
      .then(([userGroups, all]) => {
        setGroups(userGroups.groups ?? []);
        setAllGroups((all.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        setSelectedGroupId('');
      })
      .finally(() => setLoading(false));
  }, [userId]);

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
      const r = await fetch(`/api/portal/admin/users/${userId}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId, role: selectedRole }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка');
      }
      toast.success('Пользователь добавлен в группу');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setAdding(false);
  }

  async function handleRemove(groupId: string) {
    try {
      const r = await fetch(`/api/portal/admin/users/${userId}/groups?groupId=${groupId}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Ошибка');
      toast.success('Пользователь удалён из группы');
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
    <Card>
      <h3 className="text-lg font-semibold text-dark mb-4">Группы пользователя</h3>
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm min-w-[180px]"
        >
          <option value="">— Выберите группу</option>
          {availableGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as 'member' | 'moderator')}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="member">Участник</option>
          <option value="moderator">Модератор</option>
        </select>
        <Button type="button" size="sm" onClick={handleAdd} disabled={adding || !selectedGroupId}>
          {adding ? '…' : 'Добавить'}
        </Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState
          title="Нет групп"
          description="Добавьте пользователя в одну или несколько групп"
          icon={<Users className="h-10 w-10" />}
        />
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-border bg-bg-cream/30 px-3 py-2"
            >
              <span className="font-medium">{g.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">
                  {g.role === 'moderator' ? 'Модератор' : 'Участник'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-red-600 hover:text-red-700 text-xs"
                  onClick={() => handleRemove(g.id)}
                >
                  Убрать
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
