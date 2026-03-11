'use client';

/**
 * Admin users table: search, filter, pagination, edit role/status, export CSV, bulk actions, link to [id].
 */
import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, ChevronRight, Download, Users, FolderPlus, FolderMinus } from 'lucide-react';
import { GroupPickerModal } from '@/components/portal/GroupPickerModal';

export interface UserRow {
  id: string;
  email: string | null;
  role: string;
  status: string;
  display_name: string | null;
  created_at: string;
}

const ROLES = ['user', 'manager', 'admin'] as const;
const STATUSES = ['active', 'archived'] as const;

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

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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

  let filteredData = rows;
  if (statusFilter !== 'all') filteredData = filteredData.filter((u) => u.status === statusFilter);
  if (roleFilter !== 'all') filteredData = filteredData.filter((u) => u.role === roleFilter);

  function handleExportCsv() {
    const headers = ['email', 'display_name', 'role', 'status', 'created_at'];
    const csvRows = [
      headers.join(','),
      ...filteredData.map((u) =>
        headers
          .map((h) => {
            const v = u[h as keyof UserRow];
            return escapeCsvCell(v != null ? String(v) : '');
          })
          .join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Экспорт выполнен');
  }

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
          className="rounded border-border"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-border"
        />
      ),
    }),
    columnHelper.accessor('display_name', {
      header: 'Имя',
      cell: (c) => {
        const id = c.row.original.id;
        const v = c.getValue() ?? '—';
        return (
          <Link href={`/portal/admin/users/${id}`} className="text-primary hover:underline font-medium">
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
          <Link href={`/portal/admin/users/${id}`} className="text-primary hover:underline">
            {v}
          </Link>
        );
      },
    }),
    columnHelper.display({
      id: 'role',
      header: 'Роль',
      cell: ({ row }) => (
        <select
          value={row.original.role}
          onChange={(e) => handleRoleChange(row.original.id, e.target.value)}
          disabled={updating === row.original.id}
          className="rounded border border-border bg-white px-2 py-1 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      ),
    }),
    columnHelper.display({
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => (
        <select
          value={row.original.status}
          onChange={(e) => handleStatusChange(row.original.id, e.target.value)}
          disabled={updating === row.original.id}
          className="rounded border border-border bg-white px-2 py-1 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Дата',
      cell: (c) => new Date(c.getValue()).toLocaleDateString('ru'),
    }),
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
      rowSelection,
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
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="archived">Архивные</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">Все роли</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={handleExportCsv} className="ml-auto">
          <Download className="mr-2 h-4 w-4" />
          Экспорт CSV
        </Button>
      </div>
      {selectedCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium text-dark">
            <Users className="mr-1 inline h-4 w-4" />
            Выбрано: {selectedCount}
          </span>
          <span className="text-sm text-text-muted">Сменить роль:</span>
          {ROLES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant="secondary"
              disabled={bulkUpdating}
              onClick={() => handleBulkRoleChange(table.getSelectedRowModel().rows.map((row) => row.original.id), r)}
            >
              {r}
            </Button>
          ))}
          <span className="text-sm text-text-muted">Сменить статус:</span>
          {STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant="secondary"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatusChange(table.getSelectedRowModel().rows.map((row) => row.original.id), s)}
            >
              {s}
            </Button>
          ))}
          {(onAddSelectedToGroup || onRemoveSelectedFromGroup) && (
            <>
              <span className="text-sm text-text-muted ml-2">Группы:</span>
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
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
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
      {table.getPageCount() > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Строк {table.getRowModel().rows.length} из {filteredData.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
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
