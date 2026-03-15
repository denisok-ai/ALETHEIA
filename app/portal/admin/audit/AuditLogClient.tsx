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
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { SortableTableHead } from '@/components/ui/SortableTableHead';
import { sortTableBy, type SortDir } from '@/lib/table-sort';
import { downloadXlsxFromArrays } from '@/lib/export-xlsx';
import { FileText, Inbox } from 'lucide-react';
import { format } from 'date-fns';

const AUDIT_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'num', label: '№' },
  { id: 'date', label: 'Дата' },
  { id: 'action', label: 'Действие' },
  { id: 'entity', label: 'Сущность' },
  { id: 'entityId', label: 'ID' },
  { id: 'actor', label: 'Актор' },
];

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
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => AUDIT_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

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
  const auditSortGetters = useMemo<Record<string, (l: AuditLogRow) => unknown>>(
    () => ({
      num: () => 0,
      date: (l) => l.createdAt,
      action: (l) => l.action,
      entity: (l) => l.entity,
      entityId: (l) => l.entityId ?? '',
      actor: (l) => l.actorId ?? '',
    }),
    []
  );
  const sorted = useMemo(() => {
    if (!sortKey || !auditSortGetters[sortKey]) return filtered;
    return sortTableBy(filtered, auditSortGetters[sortKey], sortDir);
  }, [filtered, sortKey, sortDir, auditSortGetters]);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function handleExportCsv() {
    const headers = ['№', 'Дата', 'Действие', 'Сущность', 'ID', 'Актор'];
    const rows = sorted.map((l, i) => [
      i + 1,
      format(new Date(l.createdAt), 'dd.MM.yyyy HH:mm'),
      l.action,
      l.entity,
      l.entityId ?? '',
      l.actorId ?? '',
    ]);
    downloadXlsxFromArrays(headers, rows, `audit-${format(new Date(), 'yyyy-MM-dd')}`);
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
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все действия</option>
          {distinctActions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
        >
          <option value="">Все сущности</option>
          {distinctEntities.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm min-w-[140px]"
        >
          <option value="">Все акторы</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.email ?? u.id.slice(0, 8)}</option>
          ))}
        </select>
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
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumnIds.includes('num') && <TableHead className="w-10">№</TableHead>}
                {visibleColumnIds.includes('date') && (
                  <SortableTableHead sortKey="date" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Дата</SortableTableHead>
                )}
                {visibleColumnIds.includes('action') && (
                  <SortableTableHead sortKey="action" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Действие</SortableTableHead>
                )}
                {visibleColumnIds.includes('entity') && (
                  <SortableTableHead sortKey="entity" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Сущность</SortableTableHead>
                )}
                {visibleColumnIds.includes('entityId') && (
                  <SortableTableHead sortKey="entityId" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>ID</SortableTableHead>
                )}
                {visibleColumnIds.includes('actor') && (
                  <SortableTableHead sortKey="actor" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Актор</SortableTableHead>
                )}
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={1 + visibleColumnIds.length} className="p-0">
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
                    {visibleColumnIds.includes('num') && (
                    <TableCell className="text-[var(--portal-text-muted)] text-xs">
                      {currentPage * pageSize + idx + 1}
                    </TableCell>
                    )}
                    {visibleColumnIds.includes('date') && (
                    <TableCell className="text-[var(--portal-text-muted)] text-xs">
                      {format(new Date(l.createdAt), 'dd.MM.yyyy HH:mm')}
                    </TableCell>
                    )}
                    {visibleColumnIds.includes('action') && <TableCell className="font-medium text-[var(--portal-text)]">{l.action}</TableCell>}
                    {visibleColumnIds.includes('entity') && <TableCell className="text-[var(--portal-text-muted)]">{l.entity}</TableCell>}
                    {visibleColumnIds.includes('entityId') && <TableCell className="font-mono text-xs text-[var(--portal-text-muted)]">{l.entityId ?? '—'}</TableCell>}
                    {visibleColumnIds.includes('actor') && <TableCell className="font-mono text-xs text-[var(--portal-text-muted)]">{l.actorId?.slice(0, 8) ?? '—'}</TableCell>}
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
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            pageSizeOptions={STANDARD_PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            onExportExcel={handleExportCsv}
            exportLabel="Excel"
            columnConfig={AUDIT_TABLE_COLUMNS}
            visibleColumnIds={visibleColumnIds}
            onVisibleColumnIdsChange={setVisibleColumnIds}
          />
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
              <div><dt className="text-[var(--portal-text-muted)] inline">Действие: </dt><dd className="inline font-medium">{detailLog.action}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Сущность: </dt><dd className="inline">{detailLog.entity}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">ID: </dt><dd className="inline font-mono">{detailLog.entityId ?? '—'}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Актор: </dt><dd className="inline font-mono">{detailLog.actorId ?? '—'}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Дата: </dt><dd className="inline">{format(new Date(detailLog.createdAt), 'dd.MM.yyyy HH:mm:ss')}</dd></div>
              {detailLog.diff && (
                <div className="mt-2">
                  <dt className="text-[var(--portal-text-muted)] text-xs font-medium">Diff (JSON):</dt>
                  <dd className="mt-1 rounded bg-[#F8FAFC] p-2 text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
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
