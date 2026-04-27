'use client';

import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function TableSkeleton({ rows = 5, cols = 4, className }: TableSkeletonProps) {
  return (
    <div className={cn('animate-pulse overflow-hidden rounded-xl border border-[#E2E8F0] bg-white', className)}>
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-[#E2E8F0]" style={{ maxWidth: i === 0 ? 120 : undefined }} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[#E2E8F0]">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-4 py-3">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <div
                key={colIndex}
                className="h-4 flex-1 rounded bg-[#E2E8F0]/80"
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
