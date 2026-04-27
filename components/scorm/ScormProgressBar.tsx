'use client';

import { cn } from '@/lib/utils';

export interface ScormProgressBarProps {
  completedCount: number;
  totalCount: number;
  className?: string;
}

export function ScormProgressBar({
  completedCount,
  totalCount,
  className,
}: ScormProgressBarProps) {
  const total = Math.max(1, totalCount);
  const pct = Math.round((completedCount / total) * 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className="h-full rounded-full bg-[var(--portal-accent)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[var(--portal-text-muted)]">
        {completedCount}/{total} ({pct}%)
      </span>
    </div>
  );
}
