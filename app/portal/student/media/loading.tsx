/**
 * Loading fallback for media page.
 */
import { CardSkeleton } from '@/components/ui/CardSkeleton';

export default function MediaLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="h-8 w-48 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
