'use client';

/**
 * Media page with sidebar: group tree; filters media by selected group.
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { GroupTree } from '@/components/portal/GroupTree';
import { AdaptiveGroupsLayout } from '@/components/portal/AdaptiveGroupsLayout';
import { GroupFormModal } from '@/components/portal/GroupFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MediaAdminClient } from './MediaAdminClient';

interface MediaItem {
  id: string;
  title: string;
  file_url: string;
  mime_type: string | null;
  category: string | null;
  description?: string | null;
  type?: string;
  views_count?: number;
  allow_download?: boolean;
  rating_sum?: number;
  rating_count?: number;
  created_at: string;
  course_id?: string | null;
  course_title?: string | null;
}

export function MediaPageWithGroups({ initialItems }: { initialItems: MediaItem[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupEditId, setGroupEditId] = useState<string | null>(null);
  const [groupParentId, setGroupParentId] = useState<string | null>(null);
  const [groupMediaIds, setGroupMediaIds] = useState<Set<string>>(new Set());
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupRefreshTrigger, setGroupRefreshTrigger] = useState(0);
  const [treeVersion, setTreeVersion] = useState(0);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupMediaIds(new Set());
      return;
    }
    setLoadingGroup(true);
    fetch(`/api/portal/admin/groups/${selectedGroupId}/media`)
      .then((r) => (r.ok ? r.json() : { media: [] }))
      .then((d) => {
        const list = (d.media ?? []) as Array<{ id: string }>;
        setGroupMediaIds(new Set(list.map((m) => m.id)));
      })
      .finally(() => setLoadingGroup(false));
  }, [selectedGroupId, groupRefreshTrigger]);

  const displayItems = useMemo(() => {
    if (!selectedGroupId || groupMediaIds.size === 0) {
      return selectedGroupId && groupMediaIds.size === 0 && !loadingGroup ? [] : initialItems;
    }
    return initialItems.filter((m) => groupMediaIds.has(m.id));
  }, [initialItems, selectedGroupId, groupMediaIds, loadingGroup]);

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
    if (selectedGroupId) {
      setSelectedGroupId(null);
      setSelectedGroupName(null);
    }
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
      if (selectedGroupId === deleteGroupId) {
        setSelectedGroupId(null);
        setSelectedGroupName(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setDeleting(false);
  };

  const clearGroupFilter = () => {
    setSelectedGroupId(null);
    setSelectedGroupName(null);
  };

  return (
    <>
      <AdaptiveGroupsLayout
        storageKey="media"
        className="mt-6"
        selectedGroupId={selectedGroupId}
        selectedGroupName={selectedGroupName}
        onClearGroupFilter={clearGroupFilter}
        filterNoun="материалы"
        renderSidebar={({ closeDrawer }) => (
          <GroupTree
            key={`media-${treeVersion}`}
            moduleType="media"
            selectedGroupId={selectedGroupId}
            onSelectGroup={(id, name) => {
              setSelectedGroupId(id);
              setSelectedGroupName(name ?? null);
              closeDrawer();
            }}
            onAddGroup={handleAddGroup}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            showCounts
          />
        )}
      >
        {loadingGroup ? (
          <p className="text-[var(--portal-text-muted)] py-4">Загрузка ресурсов группы…</p>
        ) : (
          <MediaAdminClient
            key={selectedGroupId ?? 'all'}
            initialItems={displayItems}
            selectedGroupId={selectedGroupId}
            onGroupsChanged={() => setGroupRefreshTrigger((t) => t + 1)}
          />
        )}
      </AdaptiveGroupsLayout>
      <GroupFormModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        moduleType="media"
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
