/**
 * Admin section loading fallback — skeleton while page loads.
 */
import { TableSkeleton } from '@/components/ui/TableSkeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-48 animate-pulse rounded bg-bg-cream" />
      <div className="h-8 w-64 animate-pulse rounded bg-bg-cream" />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
