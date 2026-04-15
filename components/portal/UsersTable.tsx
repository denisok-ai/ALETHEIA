'use client';

/**
 * Admin users table: search, filter, pagination, edit role/status, export CSV, bulk actions, link to [id].
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { Users, FolderPlus, FolderMinus } from 'lucide-react';
import { GroupPickerModal } from '@/components/portal/GroupPickerModal';
import { downloadXlsx } from '@/lib/export-xlsx';
import type { CsvColumn } from '@/lib/export-csv';

export interface UserRow {
  id: string;
  email: string | null;
  role: string;
  status: string;
  display_name: string | null;
  created_at: string;
}

const ROLES = ['user', 'manager', 'admin'] as const;
const ROLE_LABELS: Record<string, string> = {
  user: 'Студент',
  manager: 'Менеджер',
  admin: 'Администратор',
};
const STATUSES = ['active', 'archived'] as const;
const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  archived: 'В архиве',
};

const columnHelper = createColumnHelper<UserRow>();

interface UsersTableProps {
  data: UserRow[];
  /** When set, "Remove from group" is available in bulk actions */
  selectedGroupId?: string | null;
  /** Callback to add selected users to a group (opens group picker) */
  onAddSelectedToGroup?: (userIds: string[], groupId: string) => void | Promise<void>;
  /** Callback to remove selected users from the current group (uses selectedGroupId) */
  onRemoveSelectedFromGroup?: (userIds: string[]) => void | Promise<void>;
}

const PAGE_SIZE = 10;

const USER_EXPORT_COLUMNS: CsvColumn<UserRow>[] = [
  { key: 'email', header: 'Email' },
  { key: 'display_name', header: 'Имя' },
  { key: (row) => ROLE_LABELS[row.role] ?? row.role, header: 'Роль' },
  { key: (row) => STATUS_LABELS[row.status] ?? row.status, header: 'Статус' },
  { key: (row) => new Date(row.created_at).toLocaleDateString('ru'), header: 'Дата' },
];

const USER_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'num', label: '№' },
  { id: 'select', label: 'Выбор' },
  { id: 'display_name', label: 'Имя' },
  { id: 'email', label: 'Email' },
  { id: 'role', label: 'Роль' },
  { id: 'status', label: 'Статус' },
  { id: 'created_at', label: 'Дата' },
];

export function UsersTable({
  data,
  selectedGroupId = null,
  onAddSelectedToGroup,
  onRemoveSelectedFromGroup,
}: UsersTableProps) {
  const [rows, setRows] = useState(data);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [globalFilter, setGlobalFilter] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => USER_TABLE_COLUMNS.map((c) => c.id));

  useEffect(() => {
    setRows(data);
  }, [data]);

  /** Иначе при поиске совпадения на 1-й странице не видны, если открыта 2+ страница пагинации. */
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter, statusFilter, roleFilter]);

  let filteredData = rows;
  if (statusFilter !== 'all') filteredData = filteredData.filter((u) => u.status === statusFilter);
  if (roleFilter !== 'all') filteredData = filteredData.filter((u) => u.role === roleFilter);

  async function handleRoleChange(userId: string, role: string) {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRows((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success('Роль обновлена');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка обновления');
    }
    setUpdating(null);
  }

  async function handleStatusChange(userId: string, status: string) {
    setUpdating(userId);
    try {
      const res = await fetch(`/api/portal/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
      setRows((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
      toast.success('Статус обновлён');
    } catch (e) {
      console.error(e);
      toast.error('Ошибка обновления');
    }
    setUpdating(null);
  }

  async function handleBulkRoleChange(selectedIds: string[], role: string) {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    let ok = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/portal/admin/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        if (res.ok) {
          setRows((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
          ok++;
        }
      } catch (_) {}
    }
    setRowSelection({});
    setBulkUpdating(false);
    toast.success(ok === selectedIds.length ? `Роль обновлена у ${ok} пользователей` : `Обновлено ${ok} из ${selectedIds.length}`);
  }

  async function handleBulkStatusChange(selectedIds: string[], status: string) {
    if (selectedIds.length === 0) return;
    setBulkUpdating(true);
    let ok = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/portal/admin/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          setRows((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
          ok++;
        }
      } catch (_) {}
    }
    setRowSelection({});
    setBulkUpdating(false);
    toast.success(ok === selectedIds.length ? `Статус обновлён у ${ok} пользователей` : `Обновлено ${ok} из ${selectedIds.length}`);
  }

  const columns = [
    columnHelper.display({
      id: 'num',
      header: '№',
      cell: ({ row, table }) => {
        const p = table.getState().pagination;
        return p.pageIndex * p.pageSize + row.index + 1;
      },
    }),
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected(); }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="rounded border-[#E2E8F0]"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-[#E2E8F0]"
        />
      ),
    }),
    columnHelper.accessor('display_name', {
      header: 'Имя',
      cell: (c) => {
        const id = c.row.original.id;
        const v = c.getValue() ?? '—';
        return (
          <Link href={`/portal/admin/users/${id}`} className="text-[var(--portal-accent)] hover:underline font-medium">
            {v}
          </Link>
        );
      },
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: (c) => {
        const id = c.row.original.id;
        const v = c.getValue() ?? '—';
        return (
          <Link href={`/portal/admin/users/${id}`} className="text-[var(--portal-accent)] hover:underline">
            {v}
          </Link>
        );
      },
    }),
    columnHelper.accessor('role', {
      header: 'Роль',
      cell: ({ row }) => (
        <select
          value={row.original.role}
          onChange={(e) => handleRoleChange(row.original.id, e.target.value)}
          disabled={updating === row.original.id}
          className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </select>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Статус',
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={(e) => handleStatusChange(row.original.id, e.target.value)}
          disabled={updating === row.original.id}
          className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
          ))}
        </select>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Дата',
      cell: (c) => new Date(c.getValue()).toLocaleDateString('ru'),
    }),
  ];

  const columnVisibility = Object.fromEntries(
    columns
      .map((c) => {
        const id = (c as { id?: string }).id;
        return id != null ? [id, visibleColumnIds.includes(id)] as const : null;
      })
      .filter((x): x is [string, boolean] => x != null)
  ) as Record<string, boolean>;

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
      rowSelection,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    globalFilterFn: 'includesString',
    enableRowSelection: true,
  });

  const globalFilteredCount = table.getFilteredRowModel().rows.length;

  function handleExportExcel() {
    const exportRows = table.getFilteredRowModel().rows.map((r) => r.original);
    if (exportRows.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }
    downloadXlsx(exportRows, USER_EXPORT_COLUMNS, `users-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Экспорт выполнен');
  }

  const selectedCount = table.getSelectedRowModel().rows.length;
  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

  async function handleAddToGroup(groupId: string) {
    if (selectedIds.length === 0 || !onAddSelectedToGroup) return;
    setGroupActionLoading(true);
    try {
      await onAddSelectedToGroup(selectedIds, groupId);
      setRowSelection({});
      setGroupPickerOpen(false);
    } finally {
      setGroupActionLoading(false);
    }
  }

  async function handleRemoveFromGroup() {
    if (selectedIds.length === 0 || !onRemoveSelectedFromGroup) return;
    setGroupActionLoading(true);
    try {
      await onRemoveSelectedFromGroup(selectedIds);
      setRowSelection({});
    } finally {
      setGroupActionLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={setGlobalFilter}
          placeholder="Поиск по имени или email..."
          wrapperClassName="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="archived">Архивные</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
        >
          <option value="all">Все роли</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </select>
      </div>
      {selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--portal-accent-muted)] bg-[var(--portal-accent-soft)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--portal-text)]">
            <Users className="mr-1 inline h-4 w-4" />
            Выбрано: {selectedCount}
          </span>
          <span className="text-sm text-[var(--portal-text-muted)]">Сменить роль:</span>
          {ROLES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant="secondary"
              disabled={bulkUpdating}
              onClick={() => handleBulkRoleChange(table.getSelectedRowModel().rows.map((row) => row.original.id), r)}
            >
              {ROLE_LABELS[r] ?? r}
            </Button>
          ))}
          <span className="text-sm text-[var(--portal-text-muted)]">Сменить статус:</span>
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="secondary"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatusChange(table.getSelectedRowModel().rows.map((row) => row.original.id), s)}
            >
              {STATUS_LABELS[s] ?? s}
            </Button>
          ))}
          {(onAddSelectedToGroup || onRemoveSelectedFromGroup) && (
            <>
              <span className="text-sm text-[var(--portal-text-muted)] ml-2">Группы:</span>
              {onAddSelectedToGroup && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={groupActionLoading}
                  onClick={() => setGroupPickerOpen(true)}
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-1" />
                  Добавить в группу
                </Button>
              )}
              {selectedGroupId && onRemoveSelectedFromGroup && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={groupActionLoading}
                  onClick={() => void handleRemoveFromGroup()}
                >
                  <FolderMinus className="h-3.5 w-3.5 mr-1" />
                  Исключить из группы
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {groupPickerOpen && onAddSelectedToGroup && (
        <GroupPickerModal
          open={groupPickerOpen}
          onOpenChange={setGroupPickerOpen}
          moduleType="user"
          onSelect={(groupId) => void handleAddToGroup(groupId)}
          title="Добавить выбранных пользователей в группу"
          confirmLabel="Добавить"
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sortState = table.getState().sorting[0];
                  const currentSortKey = sortState?.id ?? null;
                  const currentSortDir = sortState?.desc ? 'desc' : 'asc';
                  const handleSort = (columnId: string) => {
                    const col = table.getColumn(columnId);
                    if (col) col.toggleSorting(col.getIsSorted() === 'asc');
                  };
                  return canSort ? (
                    <SortableTableHead
                      key={h.id}
                      sortKey={h.column.id}
                      currentSortKey={currentSortKey}
                      currentSortDir={currentSortDir}
                      onSort={handleSort}
                    >
                      {typeof h.column.columnDef.header === 'string'
                        ? h.column.columnDef.header
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </SortableTableHead>
                  ) : (
                    <TableHead key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    title="Нет пользователей"
                    description="Измените фильтры или добавьте пользователей"
                    icon={<Users className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {globalFilteredCount > 0 && (
        <TablePagination
          currentPage={table.getState().pagination.pageIndex}
          totalPages={table.getPageCount()}
          total={globalFilteredCount}
          pageSize={table.getState().pagination.pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={(p) => setPagination((prev) => ({ ...prev, pageIndex: p }))}
          onPageSizeChange={(s) => setPagination((prev) => ({ ...prev, pageSize: s, pageIndex: 0 }))}
          columnConfig={USER_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
        />
      )}
    </div>
  );
}
