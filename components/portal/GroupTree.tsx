'use client';

/**
 * Sidebar tree view for hierarchical groups (Courses, Media, Users).
 * Expand/collapse, select group, optional add-group action.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
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
  onSelectGroup: (groupId: string | null) => void;
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
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
  expandedIds,
  toggleExpanded,
  showCounts,
}: {
  node: GroupTreeNode;
  level: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddGroup?: (parentId: string | null) => void;
  onEditGroup?: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
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
          isSelected ? 'bg-primary/15 text-primary' : 'hover:bg-border/50 text-dark'
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
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
          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-text-muted shrink-0" />
        )}
        <span className="truncate flex-1 min-w-0">{node.name}</span>
        {showCounts && (
          <span className="text-xs text-text-muted shrink-0">
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
          <ExternalLink className="h-3.5 w-3.5 text-text-muted" />
        </Link>
        {onAddGroup && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 min-w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onAddGroup(node.id);
            }}
            aria-label="Добавить подгруппу"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        {onEditGroup && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 min-w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onEditGroup(node.id);
            }}
            aria-label="Редактировать группу"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDeleteGroup && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 min-w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0 text-red-600 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup(node.id);
            }}
            aria-label="Удалить группу"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            level={level + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddGroup={onAddGroup}
            onEditGroup={onEditGroup}
            onDeleteGroup={onDeleteGroup}
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
      <div className={`rounded-xl border border-border bg-white p-4 ${className}`}>
        <p className="text-sm text-text-muted">Загрузка дерева групп…</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-white p-2 ${className}`}>
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-sm font-medium text-dark">
          {moduleType === 'course' && 'Группы курсов'}
          {moduleType === 'media' && 'Группы медиатеки'}
          {moduleType === 'user' && 'Группы пользователей'}
        </span>
        {onAddGroup && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-primary"
            onClick={() => onAddGroup(null)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="max-h-[70vh] overflow-y-auto">
        <button
          type="button"
          className={`w-full flex items-center gap-1 py-1.5 px-2 rounded-lg text-left ${
            !selectedGroupId ? 'bg-primary/15 text-primary' : 'hover:bg-border/50 text-dark'
          }`}
          onClick={() => onSelectGroup(null)}
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
            onAddGroup={onAddGroup}
            onEditGroup={onEditGroup}
            onDeleteGroup={onDeleteGroup}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            showCounts={showCounts}
          />
        ))}
        {tree.length === 0 && (
          <p className="text-sm text-text-muted px-2 py-4">Нет групп. Создайте группу.</p>
        )}
      </div>
    </div>
  );
}
