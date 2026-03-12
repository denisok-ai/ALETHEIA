'use client';

import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TablePagination } from '@/components/ui/TablePagination';
import { Pencil, Users } from 'lucide-react';

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

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
const PAGE_SIZES = [10, 25, 50];

export function CrmLeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
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
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [convertConfirmLead, setConvertConfirmLead] = useState<Lead | null>(null);

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
  const totalPages = Math.max(1, Math.ceil(searched.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageLeads = searched.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

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
    const headers = ['name', 'phone', 'email', 'status', 'source', 'last_order_number', 'notes', 'created_at'];
    const escape = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const rows = searched.map((l) =>
      [l.name, l.phone, l.email ?? '', l.status, l.source ?? '', l.last_order_number ?? '', l.notes ?? '', new Date(l.created_at).toISOString().slice(0, 10)].map(escape)
    );
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
        >
          <option value="all">Все статусы</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
        >
          <option value="all">Все источники</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
          <span className="text-sm font-medium text-[var(--portal-text)]">Выбрано: {selectedIds.size}</span>
          <span className="text-sm text-[var(--portal-text-muted)]">Сменить статус:</span>
          {STATUSES.map((s) => (
            <Button key={s} size="sm" variant="secondary" disabled={bulkUpdating} onClick={() => handleBulkStatus(s)}>
              {s}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Снять выбор</Button>
        </div>
      )}
      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="w-10">№</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Источник</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Сообщение</TableHead>
              <TableHead>Заметки</TableHead>
              <TableHead>Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    title="Нет лидов"
                    description="Измените фильтры или добавьте лиды через форму обратной связи"
                    icon={<Users className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageLeads.map((l, idx) => (
                <TableRow key={l.id} className="cursor-pointer hover:bg-[#F8FAFC]" onClick={() => setDetailLead(l)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.id)}
                      onChange={() => toggleSelect(l.id)}
                      className="rounded border-[#E2E8F0]"
                    />
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {pageIndex * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {new Date(l.created_at).toLocaleDateString('ru')}
                  </TableCell>
                  <TableCell className="font-medium text-[var(--portal-text)]">{l.name}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{l.source ?? '—'}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{l.phone}</TableCell>
                  <TableCell className="text-[var(--portal-text-muted)]">{l.email ?? '—'}</TableCell>
                  <TableCell>
                    <select
                      value={l.status}
                      onChange={(e) => handleStatusChange(l.id, e.target.value)}
                      disabled={updating === l.id}
                      className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-[var(--portal-text-muted)]">
                    {l.message ?? '—'}
                  </TableCell>
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
      {searched.length > 0 && (
        <div className="px-4 pb-3 pt-1 border-t border-[#E2E8F0]">
          <TablePagination
            currentPage={pageIndex}
            totalPages={totalPages}
            total={searched.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
            onExportExcel={handleExportCsv}
            exportLabel="Excel"
          />
        </div>
      )}
      </div>

      {detailLead && (
        <Dialog open onOpenChange={(open) => !open && setDetailLead(null)}>
          <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Лид: {detailLead.name}</DialogTitle>
            </DialogHeader>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="text-[var(--portal-text-muted)] inline">Телефон: </dt><dd className="inline">{detailLead.phone}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Email: </dt><dd className="inline">{detailLead.email ?? '—'}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Статус: </dt><dd className="inline">{detailLead.status}</dd></div>
              {detailLead.source && <div><dt className="text-[var(--portal-text-muted)] inline">Источник: </dt><dd className="inline">{detailLead.source}</dd></div>}
              <div><dt className="text-[var(--portal-text-muted)] inline">Дата: </dt><dd className="inline">{new Date(detailLead.created_at).toLocaleString('ru')}</dd></div>
              {detailLead.last_order_number && (
                <div><dt className="text-[var(--portal-text-muted)] inline">Оплаченный заказ: </dt><dd className="inline">{detailLead.last_order_number}</dd></div>
              )}
              {detailLead.message && <div><dt className="text-[var(--portal-text-muted)] inline">Сообщение: </dt><dd className="inline break-words">{detailLead.message}</dd></div>}
              {detailLead.notes && <div><dt className="text-[var(--portal-text-muted)] inline">Заметки: </dt><dd className="inline break-words">{detailLead.notes}</dd></div>}
            </dl>
            <div className="mt-4 flex gap-2">
              <select
                value={detailLead.status}
                onChange={(e) => { handleStatusChange(detailLead.id, e.target.value); setDetailLead((p) => p ? { ...p, status: e.target.value } : null); }}
                disabled={updating === detailLead.id}
                className="rounded border border-[#E2E8F0] bg-white px-2 py-1 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button size="sm" variant="ghost" onClick={() => { setNotesEditing(detailLead); setNotesValue(detailLead.notes ?? ''); setDetailLead(null); }}>
                <Pencil className="mr-1 h-4 w-4" /> Заметки
              </Button>
              {!detailLead.converted_to_user_id && detailLead.email && (
                <Button size="sm" variant="secondary" onClick={() => setConvertConfirmLead(detailLead)} disabled={converting === detailLead.id}>
                  Конвертировать
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!convertConfirmLead}
        onOpenChange={(open) => !open && setConvertConfirmLead(null)}
        title="Конвертировать лида в пользователя?"
        description={convertConfirmLead ? `Будет создан аккаунт для «${convertConfirmLead.name}» (${convertConfirmLead.email}). Лид получит статус «Конвертирован».` : ''}
        confirmLabel="Конвертировать"
        variant="primary"
        onConfirm={() => { if (convertConfirmLead) void handleConvert(convertConfirmLead.id); }}
      />

      {notesEditing && (
        <Dialog open onOpenChange={(open) => !open && setNotesEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Заметки: {notesEditing.name}</DialogTitle>
            </DialogHeader>
            <textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              className="mt-3 w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm min-h-[100px] text-[var(--portal-text)] placeholder:text-[var(--portal-text-soft)] focus:ring-2 focus:ring-[#6366F1] focus:border-[#6366F1]"
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
