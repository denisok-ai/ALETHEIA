'use client';

/**
 * Users page with sidebar: group tree; filters users by selected group.
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { GroupTree } from '@/components/portal/GroupTree';
import { ResizableGroupsLayout } from '@/components/portal/ResizableGroupsLayout';
import { GroupFormModal } from '@/components/portal/GroupFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UsersTable, type UserRow } from '@/components/portal/UsersTable';

export function UsersPageWithGroups({ initialRows }: { initialRows: UserRow[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupEditId, setGroupEditId] = useState<string | null>(null);
  const [groupParentId, setGroupParentId] = useState<string | null>(null);
  const [groupUserIds, setGroupUserIds] = useState<Set<string>>(new Set());
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupRefreshTrigger, setGroupRefreshTrigger] = useState(0);
  const [treeVersion, setTreeVersion] = useState(0);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupUserIds(new Set());
      return;
    }
    setLoadingGroup(true);
    fetch(`/api/portal/admin/groups/${selectedGroupId}/users`)
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => {
        const list = (d.users ?? []) as Array<{ userId: string }>;
        setGroupUserIds(new Set(list.map((u) => u.userId)));
      })
      .finally(() => setLoadingGroup(false));
  }, [selectedGroupId, groupRefreshTrigger]);

  const displayRows = useMemo(() => {
    if (!selectedGroupId || groupUserIds.size === 0) {
      return selectedGroupId && groupUserIds.size === 0 && !loadingGroup ? [] : initialRows;
    }
    return initialRows.filter((r) => groupUserIds.has(r.id));
  }, [initialRows, selectedGroupId, groupUserIds, loadingGroup]);

  const handleAddGroup = (parentId: string | null) => {
    setGroupParentId(parentId);
    setGroupEditId(null);
    setGroupModalOpen(true);
  };

  const handleGroupSuccess = () => {
    setGroupModalOpen(false);
    setGroupEditId(null);
    setGroupParentId(null);
    setTreeVersion((v) => v + 1);
    if (selectedGroupId) setSelectedGroupId(null);
  };

  const handleEditGroup = (groupId: string) => {
    setGroupEditId(groupId);
    setGroupParentId(null);
    setGroupModalOpen(true);
  };

  const handleDeleteGroup = (groupId: string) => setDeleteGroupId(groupId);

  const confirmDeleteGroup = async () => {
    if (!deleteGroupId) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/portal/admin/groups/${deleteGroupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteNestedItems: false }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Ошибка удаления');
      }
      toast.success('Группа удалена');
      setDeleteGroupId(null);
      setTreeVersion((v) => v + 1);
      if (selectedGroupId === deleteGroupId) setSelectedGroupId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setDeleting(false);
  };

  return (
    <>
    <ResizableGroupsLayout storageKey="users" className="mt-6" sidebar={
        <GroupTree
          key={`user-${treeVersion}`}
          moduleType="user"
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onAddGroup={handleAddGroup}
          onEditGroup={handleEditGroup}
          onDeleteGroup={handleDeleteGroup}
          showCounts
        />
      }
    >
      {loadingGroup ? (
        <p className="text-[var(--portal-text-muted)] py-4">Загрузка участников группы…</p>
      ) : (
        <UsersTable
          key={selectedGroupId ?? 'all'}
          data={displayRows}
          selectedGroupId={selectedGroupId}
          onAddSelectedToGroup={async (userIds, groupId) => {
            let ok = 0;
            for (const userId of userIds) {
              try {
                const r = await fetch(`/api/portal/admin/groups/${groupId}/users`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, role: 'member' }),
                });
                if (r.ok) ok++;
              } catch (_) {}
            }
            toast.success(ok === userIds.length ? `Добавлено в группу: ${ok} пользователей` : `Добавлено ${ok} из ${userIds.length}`);
            setGroupRefreshTrigger((t) => t + 1);
          }}
          onRemoveSelectedFromGroup={async (userIds) => {
            if (!selectedGroupId) return;
            let ok = 0;
            for (const userId of userIds) {
              try {
                const r = await fetch(`/api/portal/admin/users/${userId}/groups?groupId=${selectedGroupId}`, { method: 'DELETE' });
                if (r.ok) ok++;
              } catch (_) {}
            }
            toast.success(ok === userIds.length ? `Исключено из группы: ${ok} пользователей` : `Исключено ${ok} из ${userIds.length}`);
            setGroupRefreshTrigger((t) => t + 1);
          }}
        />
      )}
    </ResizableGroupsLayout>
      <GroupFormModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        moduleType="user"
        parentId={groupParentId}
        editId={groupEditId}
        onSuccess={handleGroupSuccess}
      />
      <ConfirmDialog
        open={!!deleteGroupId}
        onOpenChange={(open) => !open && setDeleteGroupId(null)}
        title="Удалить группу?"
        description="Дочерние группы будут отвязаны (не удалены). Связи курсов/медиа/пользователей с этой группой будут сняты."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => void confirmDeleteGroup()}
        loading={deleting}
      />
    </>
  );
}
