'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { sortTableBy, type SortDir } from '@/lib/table-sort';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsx } from '@/lib/export-xlsx';
import { formatPersonName } from '@/lib/format-person-name';
import { Pencil, Users } from 'lucide-react';
import { CRM_LEAD_STATUSES, CRM_LEAD_STATUS_LABEL } from '@/lib/crm-lead-status';

interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  notes: string | null;
  status: string;
  source?: string | null;
  converted_to_user_id: string | null;
  last_order_number?: string | null;
  created_at: string;
}

const LEADS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'num', label: '№' },
  { id: 'date', label: 'Дата' },
  { id: 'name', label: 'Имя' },
  { id: 'source', label: 'Источник' },
  { id: 'phone', label: 'Телефон' },
  { id: 'email', label: 'Email' },
  { id: 'status', label: 'Статус' },
  { id: 'message', label: 'Сообщение' },
  { id: 'notes', label: 'Заметки' },
];

export function CrmLeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [converting, setConverting] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [notesEditing, setNotesEditing] = useState<Lead | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [convertConfirmLead, setConvertConfirmLead] = useState<Lead | null>(null);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => LEADS_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  async function handleConvert(leadId: number) {
    setConvertConfirmLead(null);
    setConverting(leadId);
    setError(null);
    try {
      const res = await fetch('/api/portal/admin/leads/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status: 'converted', converted_to_user_id: data.userId } : l
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
    setConverting(null);
  }

  async function handleStatusChange(leadId: number, status: string) {
    setUpdating(leadId);
    setError(null);
    try {
      const res = await fetch(`/api/portal/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Ошибка');
      }
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status } : l))
      );
      toast.success('Статус обновлён');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
      toast.error('Ошибка обновления');
    }
    setUpdating(null);
  }

  async function handleSaveNotes(leadId: number, notes: string | null) {
    try {
      const res = await fetch(`/api/portal/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || null }),
      });
      if (!res.ok) throw new Error('Ошибка');
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, notes } : l))
      );
      setNotesEditing(null);
      toast.success('Заметки сохранены');
    } catch (err) {
      toast.error('Ошибка сохранения');
    }
  }

  const searchLower = search.trim().toLowerCase();
  let filtered = statusFilter === 'all' ? leads : leads.filter((l) => l.status === statusFilter);
  if (sourceFilter !== 'all') filtered = filtered.filter((l) => (l.source ?? '') === sourceFilter);
  const searched =
    !searchLower
      ? filtered
      : filtered.filter(
          (l) =>
            l.name.toLowerCase().includes(searchLower) ||
            (l.email?.toLowerCase().includes(searchLower) ?? false) ||
            l.phone.includes(search)
        );
  const leadSortGetters: Record<string, (l: Lead) => unknown> = {
    date: (l) => l.created_at,
    name: (l) => l.name,
    source: (l) => l.source ?? '',
    phone: (l) => l.phone,
    email: (l) => l.email ?? '',
    status: (l) => l.status,
    message: (l) => l.message ?? '',
    notes: (l) => l.notes ?? '',
  };
  const sorted = sortKey && leadSortGetters[sortKey]
    ? sortTableBy(searched, leadSortGetters[sortKey], sortDir)
    : searched;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageLeads = sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const sources = Array.from(new Set(leads.map((l) => l.source).filter(Boolean))) as string[];

  async function handleBulkStatus(status: string) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkUpdating(true);
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/portal/admin/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
          ok++;
        }
      } catch (_) {}
    }
    setSelectedIds(new Set());
    setBulkUpdating(false);
    toast.success(ok === ids.length ? `Статус обновлён у ${ok} лидов` : `Обновлено ${ok} из ${ids.length}`);
  }

  function handleExportCsv() {
    downloadXlsx(sorted, [
      { key: 'name', header: 'Имя' },
      { key: 'phone', header: 'Телефон' },
      { key: 'email', header: 'Email' },
      { key: 'status', header: 'Статус' },
      { key: 'source', header: 'Источник' },
      { key: 'last_order_number', header: '№ заказа' },
      { key: 'notes', header: 'Заметки' },
      { key: (l) => new Date(l.created_at).toISOString().slice(0, 10), header: 'Дата' },
    ], `leads-${new Date().toISOString().slice(0, 10)}`);
    toast.success('Экспорт выполнен');
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={setSearch}
          placeholder="Поиск по имени, email, телефону..."
          wrapperClassName="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)] focus:border-[var(--portal-accent)]"
        >
          <option value="all">Все статусы</option>
          {CRM_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>{CRM_LEAD_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)] focus:border-[var(--portal-accent)]"
        >
          <option value="all">Все источники</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--portal-accent-muted)] bg-[var(--portal-accent-soft)] px-3 py-2">
          <span className="text-sm font-medium text-[var(--portal-text)]">Выбрано: {selectedIds.size}</span>
          <span className="text-sm text-[var(--portal-text-muted)]">Сменить статус:</span>
          {CRM_LEAD_STATUSES.map((s) => (
            <Button key={s} size="sm" variant="secondary" disabled={bulkUpdating} onClick={() => handleBulkStatus(s)}>
              {CRM_LEAD_STATUS_LABEL[s]}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Снять выбор</Button>
        </div>
      )}
      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              {visibleColumnIds.includes('num') && <TableHead className="w-10">№</TableHead>}
              {visibleColumnIds.includes('date') && (
                <SortableTableHead sortKey="date" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Дата</SortableTableHead>
              )}
              {visibleColumnIds.includes('name') && (
                <SortableTableHead sortKey="name" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Имя</SortableTableHead>
              )}
              {visibleColumnIds.includes('source') && (
                <SortableTableHead sortKey="source" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Источник</SortableTableHead>
              )}
              {visibleColumnIds.includes('phone') && (
                <SortableTableHead sortKey="phone" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Телефон</SortableTableHead>
              )}
              {visibleColumnIds.includes('email') && (
                <SortableTableHead sortKey="email" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Email</SortableTableHead>
              )}
              {visibleColumnIds.includes('status') && (
                <SortableTableHead sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Статус</SortableTableHead>
              )}
              {visibleColumnIds.includes('message') && (
                <SortableTableHead sortKey="message" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Сообщение</SortableTableHead>
              )}
              {visibleColumnIds.includes('notes') && (
                <SortableTableHead sortKey="notes" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Заметки</SortableTableHead>
              )}
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + visibleColumnIds.length} className="p-0">
                  <EmptyState
                    title="Нет лидов"
                    description="Измените фильтры или добавьте лиды через форму обратной связи"
                    icon={<Users className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageLeads.map((l, idx) => (
                <TableRow
                  key={l.id}
                  className="cursor-pointer hover:bg-[#F8FAFC]"
                  onClick={() => router.push(`/portal/admin/crm/leads/${l.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.id)}
                      onChange={() => toggleSelect(l.id)}
                      className="rounded border-[#E2E8F0]"
                    />
                  </TableCell>
                  {visibleColumnIds.includes('num') && (
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {pageIndex * pageSize + idx + 1}
                  </TableCell>
                  )}
                  {visibleColumnIds.includes('date') && (
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {new Date(l.created_at).toLocaleDateString('ru')}
                  </TableCell>
                  )}
                  {visibleColumnIds.includes('name') && <TableCell className="font-medium text-[var(--portal-text)]">{formatPersonName(l.name)}</TableCell>}
                  {visibleColumnIds.includes('source') && <TableCell className="text-[var(--portal-text-muted)]">{l.source ?? '—'}</TableCell>}
                  {visibleColumnIds.includes('phone') && <TableCell className="text-[var(--portal-text-muted)]">{l.phone}</TableCell>}
                  {visibleColumnIds.includes('email') && <TableCell className="text-[var(--portal-text-muted)]">{l.email ?? '—'}</TableCell>}
                  {visibleColumnIds.includes('status') && (
                  <TableCell>
                    <select
                      value={l.status}
                      onChange={(e) => handleStatusChange(l.id, e.target.value)}
                      disabled={updating === l.id}
                      className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)]"
                    >
                      {CRM_LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {CRM_LEAD_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  )}
                  {visibleColumnIds.includes('message') && (
                  <TableCell className="max-w-[180px] truncate text-[var(--portal-text-muted)]">
                    {l.message ?? '—'}
                  </TableCell>
                  )}
                  {visibleColumnIds.includes('notes') && (
                  <TableCell className="max-w-[120px]">
                    <span className="truncate block text-[var(--portal-text-muted)] text-xs">
                      {l.notes ? (l.notes.length > 40 ? l.notes.slice(0, 40) + '…' : l.notes) : '—'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setNotesEditing(l);
                        setNotesValue(l.notes ?? '');
                      }}
                      aria-label="Заметки"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                  )}
                  <TableCell>
                    {l.converted_to_user_id ? (
                      <span className="text-xs text-green-600">Конвертирован</span>
                    ) : l.email ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { e.stopPropagation(); setConvertConfirmLead(l); }}
                        disabled={converting === l.id}
                      >
                        {converting === l.id ? '…' : 'Конвертировать'}
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--portal-text-muted)]">Нет email</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      {sorted.length > 0 && (
        <TablePagination
          currentPage={pageIndex}
          totalPages={totalPages}
          total={sorted.length}
          pageSize={pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          onExportExcel={handleExportCsv}
          exportLabel="Excel"
          columnConfig={LEADS_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
        />
      )}
      </div>

      <ConfirmDialog
        open={!!convertConfirmLead}
        onOpenChange={(open) => !open && setConvertConfirmLead(null)}
        title="Конвертировать лида в пользователя?"
        description={convertConfirmLead ? `Будет создан аккаунт для «${formatPersonName(convertConfirmLead.name)}» (${convertConfirmLead.email}). Лид получит статус «Конвертирован».` : ''}
        confirmLabel="Конвертировать"
        variant="primary"
        onConfirm={() => { if (convertConfirmLead) void handleConvert(convertConfirmLead.id); }}
      />

      {notesEditing && (
        <Dialog open onOpenChange={(open) => !open && setNotesEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Заметки: {formatPersonName(notesEditing.name)}</DialogTitle>
            </DialogHeader>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              className="mt-3 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm min-h-[100px] text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)] focus:ring-2 focus:ring-[var(--portal-accent)] focus:border-[var(--portal-accent)]"
              placeholder="Заметки по лиду..."
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={() => handleSaveNotes(notesEditing.id, notesValue || null)}>
                Сохранить
              </Button>
              <Button variant="ghost" onClick={() => setNotesEditing(null)}>
                Отмена
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
