'use client';

import * as React from 'react';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Global filter value (e.g. from SearchInput); table will filter on all columns that have accessorFn */
  globalFilter?: string;
  /** Controlled sorting (optional) */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  /** Optional row click handler */
  onRowClick?: (row: TData) => void;
  /** Optional id accessor for key and selection */
  getRowId?: (row: TData) => string;
  className?: string;
  emptyNode?: React.ReactNode;
}

export function DataTable<TData>({
  columns,
  data,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  globalFilter,
  sorting,
  onSortingChange,
  onRowClick,
  getRowId,
  className,
  emptyNode,
}: DataTableProps<TData>) {
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [internalSorting, setInternalSorting] = React.useState<SortingState>([]);
  const sortState = sorting ?? internalSorting;
  const setSortState = onSortingChange ?? setInternalSorting;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel as unknown as Parameters<typeof useReactTable>[0]['getCoreRowModel'],
    getPaginationRowModel: getPaginationRowModel as unknown as Parameters<typeof useReactTable>[0]['getPaginationRowModel'],
    getSortedRowModel: getSortedRowModel as unknown as Parameters<typeof useReactTable>[0]['getSortedRowModel'],
    getFilteredRowModel: getFilteredRowModel as unknown as Parameters<typeof useReactTable>[0]['getFilteredRowModel'],
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      setPagination(next);
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sortState) : updater;
      setSortState(next);
    },
    state: {
      pagination,
      sorting: sortState,
      globalFilter: globalFilter ?? '',
    },
    getRowId: getRowId as (row: TData) => string,
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-lg border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-[var(--portal-text-muted)]"
                >
                  {emptyNode ?? 'Нет записей'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-[var(--portal-text-muted)]">
            Строк: {table.getFilteredRowModel().rows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
