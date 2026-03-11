'use client';

import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('animate-pulse overflow-hidden rounded-xl border border-border bg-white', className)}>
      <div className="border-b border-border bg-bg-soft px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-bg-cream" style={{ maxWidth: i === 0 ? 120 : undefined }} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 flex-1 rounded bg-bg-cream/80"
                style={{
                  maxWidth: colIndex === 0 ? 80 : undefined,
                  animationDelay: `${rowIndex * 50 + colIndex * 20}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
