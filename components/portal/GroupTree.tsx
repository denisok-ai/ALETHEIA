'use client';

/**
 * Sidebar tree view for hierarchical groups (Courses, Media, Users).
 * Expand/collapse, select group, optional add-group action.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2, ExternalLink, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface GroupTreeNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  moduleType: string;
  type: string;
  accessType: string;
  displayOrder: number;
  childrenCount: number;
  coursesCount: number;
  mediaCount: number;
  usersCount: number;
  children: GroupTreeNode[];
}

export interface GroupTreeProps {
  moduleType: 'course' | 'media' | 'user';
  selectedGroupId: string | null;
  /** Второй аргумент — название выбранной группы (для фильтров/chip); для «Все» — null */
  onSelectGroup: (groupId: string | null, groupName?: string | null) => void;
  onAddGroup?: (parentId: string | null) => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  showCounts?: boolean;
  className?: string;
}

function TreeRow({
  node,
  level,
  selectedId,
  onSelect,
  expandedIds,
  toggleExpanded,
  showCounts,
}: {
  node: GroupTreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  showCounts: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer group ${
          isSelected ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'hover:bg-[#F8FAFC] text-[var(--portal-text)]'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.id, node.name)}
      >
        <button
          type="button"
          className="p-0.5 rounded hover:bg-black/10"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleExpanded(node.id);
          }}
          aria-expanded={hasChildren ? isExpanded : undefined}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4 inline-block" />
          )}
        </button>
        {hasChildren && isExpanded ? (
          <FolderOpen className="h-4 w-4 text-[#6366F1] shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-[var(--portal-text-muted)] shrink-0" />
        )}
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {showCounts && (
          <span className="text-xs text-[var(--portal-text-muted)] shrink-0">
            {node.moduleType === 'course' && node.coursesCount > 0 && node.coursesCount}
            {node.moduleType === 'media' && node.mediaCount > 0 && node.mediaCount}
            {node.moduleType === 'user' && node.usersCount > 0 && node.usersCount}
          </span>
        )}
        <Link
          href={`/portal/admin/groups/${node.id}`}
          className="p-1 rounded hover:bg-black/10 opacity-0 group-hover:opacity-100 shrink-0"
          onClick={(e) => e.stopPropagation()}
          title="Открыть страницу группы"
          aria-label="Открыть страницу группы"
        >
          <ExternalLink className="h-3.5 w-3.5 text-[var(--portal-text-muted)]" />
        </Link>
      </div>
      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            level={level + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            showCounts={showCounts}
          />
        ))}
    </div>
  );
}

export function GroupTree({
  moduleType,
  selectedGroupId,
  onSelectGroup,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  showCounts = true,
  className = '',
}: GroupTreeProps) {
  const [tree, setTree] = useState<GroupTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portal/admin/groups/tree?moduleType=${moduleType}`)
      .then((r) => (r.ok ? r.json() : { tree: [] }))
      .then((d) => {
        setTree(d.tree ?? []);
      })
      .finally(() => setLoading(false));
  }, [moduleType]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className={`portal-card p-4 ${className}`}>
        <p className="text-sm text-[var(--portal-text-muted)]">Загрузка дерева групп…</p>
      </div>
    );
  }

  return (
    <div className={`portal-card flex flex-col p-0 overflow-hidden ${className}`}>
      <div className="shrink-0 px-2 pt-2 pb-1">
        <span className="text-sm font-medium text-[var(--portal-text)] block mb-2">
          {moduleType === 'course' && 'Группы курсов'}
          {moduleType === 'media' && 'Группы медиатеки'}
          {moduleType === 'user' && 'Группы пользователей'}
        </span>
        <div className="flex flex-wrap gap-1">
          {onAddGroup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[#6366F1] px-2"
              onClick={() => onAddGroup(null)}
              title="Добавить группу (корневую)"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Добавить
            </Button>
          )}
          {selectedGroupId && onAddGroup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[#6366F1] px-2"
              onClick={() => onAddGroup(selectedGroupId)}
              title="Добавить подгруппу"
            >
              <FolderPlus className="h-3.5 w-3.5 mr-1" />
              Подгруппа
            </Button>
          )}
          {selectedGroupId && onEditGroup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onEditGroup(selectedGroupId)}
              title="Изменить группу"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Изменить
            </Button>
          )}
          {selectedGroupId && onDeleteGroup && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-red-600 hover:text-red-700"
              onClick={() => onDeleteGroup(selectedGroupId)}
              title="Удалить группу"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Удалить
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 max-h-[70vh] overflow-y-auto px-2 pb-2">
        <button
          type="button"
          className={`w-full flex items-center gap-1 py-1.5 px-2 rounded-lg text-left ${
            !selectedGroupId ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'hover:bg-[#F8FAFC] text-[var(--portal-text)]'
          }`}
          onClick={() => onSelectGroup(null, null)}
        >
          <span className="w-4 inline-block" />
          <span className="truncate">Все</span>
        </button>
        {tree.map((node) => (
          <TreeRow
            key={node.id}
            node={node}
            level={0}
            selectedId={selectedGroupId}
            onSelect={onSelectGroup}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            showCounts={showCounts}
          />
        ))}
        {tree.length === 0 && (
          <p className="text-sm text-[var(--portal-text-muted)] px-2 py-4">Нет групп. Создайте группу.</p>
        )}
      </div>
    </div>
  );
}
