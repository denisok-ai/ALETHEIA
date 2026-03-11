'use client';

import { cn } from '@/lib/utils';

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl border border-border bg-white p-4', className)}>
      <div className="h-5 w-1/3 rounded bg-bg-cream" />
      <div className="mt-3 h-4 w-full rounded bg-bg-cream/80" />
      <div className="mt-2 h-4 w-4/5 rounded bg-bg-cream/80" />
      <div className="mt-4 h-8 w-24 rounded bg-bg-cream" />
    </div>
  );
}
