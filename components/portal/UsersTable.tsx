'use client';

/**
 * Admin users table: filter by status (active/archived), edit role/status.
 */
import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';

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
}

export function UsersTable({ data }: UsersTableProps) {
  const [rows, setRows] = useState(data);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  const filteredData =
    statusFilter === 'all' ? rows : rows.filter((u) => u.status === statusFilter);

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
    } catch (e) {
      console.error(e);
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
    } catch (e) {
      console.error(e);
    }
    setUpdating(null);
  }

  const columns = [
    columnHelper.accessor('display_name', { header: 'Имя', cell: (c) => c.getValue() ?? '—' }),
    columnHelper.accessor('email', { header: 'Email', cell: (c) => c.getValue() ?? '—' }),
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
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="archived">Архивные</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-bg-soft">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3 font-medium text-dark">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border hover:bg-bg-cream">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-text-muted">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
