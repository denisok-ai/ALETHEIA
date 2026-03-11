'use client';

import { useState, useEffect, useMemo } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
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
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Download, FileText, Inbox } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLogRow {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: string | null;
  diff: string | null;
  createdAt: string;
}

export function AuditLogClient() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [detailLog, setDetailLog] = useState<AuditLogRow | null>(null);
  const [users, setUsers] = useState<{ id: string; email: string | null }[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch('/api/portal/admin/audit/actors')
      .then(async (r) => {
        if (!r.ok) return { users: [] };
        return r.json();
      })
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entity', entityFilter);
    if (actorFilter) params.set('actorId', actorFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    fetch(`/api/portal/admin/audit?${params}`)
      .then(async (r) => {
        if (!r.ok) return { logs: [] };
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setLogs(d.logs ?? []);
          setPage(0);
        }
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [actionFilter, entityFilter, actorFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.trim().toLowerCase();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        (l.entityId?.toLowerCase().includes(q)) ||
        (l.actorId?.toLowerCase().includes(q))
    );
  }, [logs, search]);

  const distinctActions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const distinctEntities = useMemo(() => Array.from(new Set(logs.map((l) => l.entity))).sort(), [logs]);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const PAGE_SIZES = [5, 10, 50] as const;

  function handleExportCsv() {
    const headers = ['id', 'action', 'entity', 'entityId', 'actorId', 'createdAt'];
    const escape = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const rows = filtered.map((l) =>
      [l.id, l.action, l.entity, l.entityId ?? '', l.actorId ?? '', l.createdAt].map((v) => escape(String(v)))
    );
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={setSearch}
          placeholder="Поиск по действию, сущности, ID..."
          wrapperClassName="max-w-xs"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">Все действия</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm"
        >
          <option value="">Все сущности</option>
          {distinctEntities.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm min-w-[140px]"
        >
          <option value="">Все акторы</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email ?? u.id.slice(0, 8)}</option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Экспорт CSV
        </Button>
        <DateRangeFilter
          from={dateFrom || undefined}
          to={dateTo || undefined}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : (
        <>
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">№</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Сущность</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Актор</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      title="Записей нет"
                      description="Измените фильтры или период"
                      icon={<Inbox className="h-10 w-10" />}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((l, idx) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-text-muted text-xs">
                      {currentPage * pageSize + idx + 1}
                    </TableCell>
                    <TableCell className="text-text-muted text-xs">
                      {format(new Date(l.createdAt), 'dd.MM.yyyy HH:mm')}
                    </TableCell>
                    <TableCell className="font-medium text-dark">{l.action}</TableCell>
                    <TableCell className="text-text-muted">{l.entity}</TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">{l.entityId ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">{l.actorId?.slice(0, 8) ?? '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailLog(l)} title="Подробнее" aria-label="Подробнее о записи журнала">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
            <div className="flex items-center gap-2">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => { setPageSize(size); setPage(0); }}
                  className={`rounded px-2 py-1 text-sm ${pageSize === size ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:bg-bg-cream'}`}
                >
                  +{size}
                </button>
              ))}
              <span className="ml-2 text-sm text-text-muted">
                Записи {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, total)} из {total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded border border-border bg-white px-2 py-1 text-sm disabled:opacity-50"
                aria-label="Предыдущая страница"
              >
                ←
              </button>
              <span className="text-sm text-text-muted">
                Страница {currentPage + 1} из {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded border border-border bg-white px-2 py-1 text-sm disabled:opacity-50"
                aria-label="Следующая страница"
              >
                →
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {detailLog && (
        <Dialog open onOpenChange={(open) => !open && setDetailLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Запись журнала #{detailLog.id}</DialogTitle>
            </DialogHeader>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="text-text-muted inline">Действие: </dt><dd className="inline font-medium">{detailLog.action}</dd></div>
              <div><dt className="text-text-muted inline">Сущность: </dt><dd className="inline">{detailLog.entity}</dd></div>
              <div><dt className="text-text-muted inline">ID: </dt><dd className="inline font-mono">{detailLog.entityId ?? '—'}</dd></div>
              <div><dt className="text-text-muted inline">Актор: </dt><dd className="inline font-mono">{detailLog.actorId ?? '—'}</dd></div>
              <div><dt className="text-text-muted inline">Дата: </dt><dd className="inline">{format(new Date(detailLog.createdAt), 'dd.MM.yyyy HH:mm:ss')}</dd></div>
              {detailLog.diff && (
                <div className="mt-2">
                  <dt className="text-text-muted text-xs font-medium">Diff (JSON):</dt>
                  <dd className="mt-1 rounded bg-bg-cream p-2 text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(detailLog.diff), null, 2);
                      } catch {
                        return detailLog.diff;
                      }
                    })()}
                  </dd>
                </div>
              )}
            </dl>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
