'use client';

import { cn } from '@/lib/utils';

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl border border-[#E2E8F0] bg-white p-4', className)}>
      <div className="h-5 w-1/3 rounded bg-[#E2E8F0]" />
      <div className="mt-3 h-4 w-full rounded bg-[#E2E8F0]/80" />
      <div className="mt-2 h-4 w-4/5 rounded bg-[#E2E8F0]/80" />
      <div className="mt-4 h-8 w-24 rounded bg-[#E2E8F0]" />
    </div>
  );
}
