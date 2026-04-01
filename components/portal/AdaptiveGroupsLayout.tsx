'use client';

/**
 * На экранах < xl панель групп уезжает в диалог; на xl+ — ResizableGroupsLayout.
 * Показывает строку «Показано: …» и сброс фильтра на узкой ширине.
 */
import { useState, useEffect, useCallback } from 'react';
import { ResizableGroupsLayout } from '@/components/portal/ResizableGroupsLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderTree, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const XL_PX = 1280;

export interface AdaptiveGroupsLayoutProps {
  storageKey: string;
  renderSidebar: (helpers: { closeDrawer: () => void }) => React.ReactNode;
  children: React.ReactNode;
  className?: string;
  selectedGroupId: string | null;
  selectedGroupName: string | null;
  onClearGroupFilter: () => void;
  /** Существительное после «все»: материалы, курсы, пользователи */
  filterNoun: string;
}

export function AdaptiveGroupsLayout({
  storageKey,
  renderSidebar,
  children,
  className,
  selectedGroupId,
  selectedGroupName,
  onClearGroupFilter,
  filterNoun,
}: AdaptiveGroupsLayoutProps) {
  const [isXl, setIsXl] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${XL_PX}px)`);
    const apply = () => setIsXl(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const noop = useCallback(() => {}, []);

  if (isXl) {
    return (
      <ResizableGroupsLayout storageKey={storageKey} className={className} sidebar={renderSidebar({ closeDrawer: noop })}>
        {children}
      </ResizableGroupsLayout>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button type="button" variant="secondary" size="sm" className="gap-2 min-h-9" onClick={() => setDrawerOpen(true)}>
          <FolderTree className="h-4 w-4 shrink-0" aria-hidden />
          Группы
        </Button>
        <span className="text-[var(--portal-text-muted)]">
          {selectedGroupId && selectedGroupName ? (
            <>
              Показано: группа «<span className="font-medium text-[var(--portal-text)]">{selectedGroupName}</span>»
            </>
          ) : (
            <>Показано: все {filterNoun}</>
          )}
        </span>
        {selectedGroupId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 text-[var(--portal-accent)]"
            onClick={onClearGroupFilter}
          >
            <X className="h-4 w-4 mr-1 shrink-0" aria-hidden />
            Сбросить
          </Button>
        )}
      </div>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4 pb-2 mb-0 border-b border-[var(--portal-sidebar-border)] shrink-0">
            <DialogTitle>Группы</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 p-2">{renderSidebar({ closeDrawer: () => setDrawerOpen(false) })}</div>
        </DialogContent>
      </Dialog>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
