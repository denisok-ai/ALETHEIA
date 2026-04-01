'use client';

/**
 * Courses page with sidebar: group tree + group CRUD modal; filters courses by selected group.
 */
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { GroupTree } from '@/components/portal/GroupTree';
import { AdaptiveGroupsLayout } from '@/components/portal/AdaptiveGroupsLayout';
import { GroupFormModal } from '@/components/portal/GroupFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CoursesAdminClient } from './CoursesAdminClient';

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

export function CoursesPageWithGroups({ initialCourses }: { initialCourses: Course[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupEditId, setGroupEditId] = useState<string | null>(null);
  const [groupParentId, setGroupParentId] = useState<string | null>(null);
  const [groupCourseIds, setGroupCourseIds] = useState<Set<string>>(new Set());
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [groupRefreshTrigger, setGroupRefreshTrigger] = useState(0);
  const [treeVersion, setTreeVersion] = useState(0);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupCourseIds(new Set());
      return;
    }
    setLoadingGroup(true);
    fetch(`/api/portal/admin/groups/${selectedGroupId}/courses`)
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => {
        const list = (d.courses ?? []) as Array<{ id: string }>;
        setGroupCourseIds(new Set(list.map((c) => c.id)));
      })
      .finally(() => setLoadingGroup(false));
  }, [selectedGroupId, groupRefreshTrigger]);

  const displayCourses = useMemo(() => {
    if (!selectedGroupId || groupCourseIds.size === 0) {
      return selectedGroupId && groupCourseIds.size === 0 && !loadingGroup ? [] : initialCourses;
    }
    return initialCourses.filter((c) => groupCourseIds.has(c.id));
  }, [initialCourses, selectedGroupId, groupCourseIds, loadingGroup]);

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
        storageKey="courses"
        selectedGroupId={selectedGroupId}
        selectedGroupName={selectedGroupName}
        onClearGroupFilter={clearGroupFilter}
        filterNoun="курсы"
        renderSidebar={({ closeDrawer }) => (
          <GroupTree
            key={`course-${treeVersion}`}
            moduleType="course"
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
          <p className="text-[var(--portal-text-muted)] py-4">Загрузка курсов группы…</p>
        ) : (
          <CoursesAdminClient
            key={selectedGroupId ?? 'all'}
            initialCourses={displayCourses}
            selectedGroupId={selectedGroupId}
            onGroupsChanged={() => setGroupRefreshTrigger((t) => t + 1)}
          />
        )}
      </AdaptiveGroupsLayout>
      <GroupFormModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        moduleType="course"
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
