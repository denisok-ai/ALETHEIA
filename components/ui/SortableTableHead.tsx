'use client';

/**
 * Заголовок колонки таблицы с сортировкой по клику. Показывает иконку направления при активной сортировке.
 */
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SortDir } from '@/lib/table-sort';

interface SortableTableHeadProps {
  /** Текст заголовка */
  children: React.ReactNode;
  /** Id колонки для сортировки */
  sortKey: string;
  /** Текущая активная колонка сортировки (null = нет) */
  currentSortKey: string | null;
  /** Текущее направление */
  currentSortDir: SortDir;
  /** Вызов при клике: (columnId) => void. При повторном клике по той же колонке переключается направление. */
  onSort: (columnId: string) => void;
  className?: string;
}

export function SortableTableHead({
  children,
  sortKey,
  currentSortKey,
  currentSortDir,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey;
  const handleClick = () => onSort(sortKey);
  const ariaSort = isActive ? (currentSortDir === 'asc' ? 'ascending' : 'descending') : undefined;

  return (
    <TableHead
      className={cn('cursor-pointer select-none whitespace-nowrap', className)}
      aria-sort={ariaSort}
      scope="col"
    >
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 text-left font-semibold text-[var(--portal-text)] hover:text-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-1 rounded px-1 -mx-1"
      >
        {children}
        {isActive ? (
          currentSortDir === 'asc' ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[#6366F1]" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#6366F1]" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--portal-text-muted)]" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}
