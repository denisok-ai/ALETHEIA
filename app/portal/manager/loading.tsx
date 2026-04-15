/**
 * Manager section loading fallback — skeleton while page loads.
 */
import { TableSkeleton } from '@/components/ui/TableSkeleton';

export default function ManagerLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="h-8 w-56 animate-pulse rounded bg-[#F1F5F9]" />
      <TableSkeleton rows={5} cols={4} />
    </div>
  );
}
