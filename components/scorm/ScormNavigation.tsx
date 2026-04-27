'use client';

import { Check, Circle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ScoStatus = 'completed' | 'in_progress' | 'not_started';

export interface ScoItem {
  identifier: string;
  title?: string;
  url: string;
  status?: ScoStatus;
}

export interface ScormNavigationProps {
  items: ScoItem[];
  currentLessonId: string | null;
  onSelect: (identifier: string) => void;
  className?: string;
}

export function ScormNavigation({
  items,
  currentLessonId,
  onSelect,
  className,
}: ScormNavigationProps) {
  return (
    <nav
      className={cn('flex w-56 flex-col border-r border-[#E2E8F0] bg-[#F8FAFC] p-3', className)}
      aria-label="Навигация по курсу"
    >
      <ul className="space-y-1">
        {items.map((it) => {
          const isCurrent = it.identifier === currentLessonId;
          const status = it.status ?? 'not_started';
          return (
            <li key={it.identifier}>
              <button
                type="button"
                onClick={() => onSelect(it.identifier)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  isCurrent
                    ? 'bg-[var(--portal-accent-soft)] text-[var(--portal-accent-dark)] font-medium'
                    : 'text-[var(--portal-text)] hover:bg-[#F8FAFC]',
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--portal-text-muted)]">
                  {status === 'completed' && <Check className="h-4 w-4 text-emerald-600" />}
                  {status === 'in_progress' && <Play className="h-3 w-3" />}
                  {status === 'not_started' && <Circle className="h-3.5 w-3" />}
                </span>
                <span className="truncate">{it.title || it.identifier}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
