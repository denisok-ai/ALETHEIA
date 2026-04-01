'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/SearchInput';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
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
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Check, FileText, Ban, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { TablePagination, STANDARD_PAGE_SIZES, type ColumnConfigItem } from '@/components/ui/TablePagination';
import { downloadXlsx } from '@/lib/export-xlsx';

export interface OrderRow {
  id: number;
  orderNumber: string;
  tariffId: string;
  amount: number;
  clientEmail: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  userId?: string | null;
}


const PAYMENTS_TABLE_COLUMNS: ColumnConfigItem[] = [
  { id: 'num', label: '№' },
  { id: 'orderNumber', label: '№ заказа' },
  { id: 'tariffId', label: 'Тариф' },
  { id: 'amount', label: 'Сумма' },
  { id: 'clientEmail', label: 'Email' },
  { id: 'status', label: 'Статус' },
  { id: 'date', label: 'Дата' },
];

export function PaymentsTableClient({
  initialOrders,
  initialSearch = '',
}: {
  initialOrders: OrderRow[];
  initialSearch?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => PAYMENTS_TABLE_COLUMNS.map((c) => c.id));
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const handleSort = (columnId: string) => {
    setPage(0);
    if (sortKey === columnId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(columnId); setSortDir('asc'); }
  };

  const tariffIds = Array.from(new Set(orders.map((o) => o.tariffId))).sort();
  const [tariffFilter, setTariffFilter] = useState<string>('all');

  async function handleConfirm(orderId: number) {
    setConfirming(orderId);
    try {
      const res = await fetch(`/api/portal/admin/orders/${orderId}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Ошибка');
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: 'paid', paidAt: new Date().toISOString() }
            : o
        )
      );
      toast.success('Оплата подтверждена');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
    setConfirming(null);
  }

  async function handleCancel(o: OrderRow) {
    setCancelTarget(null);
    setCancelling(true);
    try {
      const res = await fetch(`/api/portal/admin/orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (!res.ok) throw new Error('Ошибка');
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: 'cancelled' } : x)));
      setDetailOrder((prev) => (prev?.id === o.id ? { ...prev, status: 'cancelled' } : prev));
      toast.success('Заказ отменён');
    } catch (e) {
      toast.error('Ошибка отмены');
    }
    setCancelling(false);
  }

  async function handleRefund(o: OrderRow) {
    setRefundTarget(null);
    setRefunding(true);
    try {
      const res = await fetch(`/api/portal/admin/orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'refunded' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Ошибка');
      }
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: 'refunded' } : x)));
      setDetailOrder((prev) => (prev?.id === o.id ? { ...prev, status: 'refunded' } : prev));
      toast.success('Возврат оформлен. Доступ к курсу отозван.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка возврата');
    }
    setRefunding(false);
  }

  const searchLower = search.trim().toLowerCase();
  let filtered = orders;
  if (statusFilter !== 'all') filtered = filtered.filter((o) => o.status === statusFilter);
  if (tariffFilter !== 'all') filtered = filtered.filter((o) => o.tariffId === tariffFilter);
  if (searchLower) {
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(searchLower) ||
        o.clientEmail.toLowerCase().includes(searchLower)
    );
  }
  if (dateFrom || dateTo) {
    filtered = filtered.filter((o) => {
      const d = new Date(o.createdAt).getTime();
      if (dateFrom && d < new Date(dateFrom).getTime()) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59').getTime()) return false;
      return true;
    });
  }

  const orderSortGetters: Record<string, (o: OrderRow) => unknown> = {
    orderNumber: (o) => o.orderNumber,
    tariffId: (o) => o.tariffId,
    amount: (o) => o.amount,
    clientEmail: (o) => o.clientEmail,
    status: (o) => o.status,
    date: (o) => o.paidAt ?? o.createdAt,
  };
  const sorted = sortKey && orderSortGetters[sortKey]
    ? sortTableBy(filtered, orderSortGetters[sortKey], sortDir)
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageIndex = Math.min(page, totalPages - 1);
  const pageOrders = sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const handleExportExcel = () => {
    downloadXlsx(sorted, [
      { key: 'orderNumber', header: '№ заказа' },
      { key: 'tariffId', header: 'Тариф' },
      { key: 'amount', header: 'Сумма' },
      { key: 'clientEmail', header: 'Email' },
      { key: 'status', header: 'Статус' },
      { key: 'paidAt', header: 'Оплачен' },
      { key: 'createdAt', header: 'Создан' },
    ], `payments-${format(new Date(), 'yyyy-MM-dd')}`);
  };

  return (
    <div className="space-y-4">
      <div className="portal-card p-4 flex flex-wrap items-center gap-3">
        <SearchInput
          onSearch={setSearch}
          placeholder="Поиск по № заказа или email..."
          wrapperClassName="max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)] focus:border-[var(--portal-accent)]"
        >
          <option value="all">Все статусы</option>
          <option value="pending">Ожидает</option>
          <option value="paid">Оплачен</option>
          <option value="refunded">Возврат</option>
          <option value="cancelled">Отменён</option>
        </select>
        <select
          value={tariffFilter}
          onChange={(e) => { setTariffFilter(e.target.value); setPage(0); }}
          className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[var(--portal-accent)] focus:border-[var(--portal-accent)]"
        >
          <option value="all">Все тарифы</option>
          {tariffIds.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <DateRangeFilter
          from={dateFrom || undefined}
          to={dateTo || undefined}
          onFromChange={(v) => { setDateFrom(v); setPage(0); }}
          onToChange={(v) => { setDateTo(v); setPage(0); }}
        />
      </div>

      <div className="portal-card overflow-hidden p-0">
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <Table>
          <TableHeader>
              <TableRow>
                {visibleColumnIds.includes('num') && <TableHead className="w-10">№</TableHead>}
                <TableHead className="w-8"></TableHead>
                {visibleColumnIds.includes('orderNumber') && (
                  <SortableTableHead sortKey="orderNumber" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>№ заказа</SortableTableHead>
                )}
                {visibleColumnIds.includes('tariffId') && (
                  <SortableTableHead sortKey="tariffId" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Тариф</SortableTableHead>
                )}
                {visibleColumnIds.includes('amount') && (
                  <SortableTableHead sortKey="amount" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Сумма</SortableTableHead>
                )}
                {visibleColumnIds.includes('clientEmail') && (
                  <SortableTableHead sortKey="clientEmail" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Email</SortableTableHead>
                )}
                {visibleColumnIds.includes('status') && (
                  <SortableTableHead sortKey="status" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Статус</SortableTableHead>
                )}
                {visibleColumnIds.includes('date') && (
                  <SortableTableHead sortKey="date" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}>Дата</SortableTableHead>
                )}
                <TableHead>Действия</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
            {pageOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2 + visibleColumnIds.length} className="p-0">
                  <EmptyState
                    title="Нет заказов"
                    description="Измените фильтры или период"
                    icon={<CreditCard className="h-10 w-10" />}
                  />
                </TableCell>
              </TableRow>
            ) : (
              pageOrders.map((o, idx) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer hover:bg-[#F8FAFC]"
                  onClick={() => setDetailOrder(o)}
                >
                  {visibleColumnIds.includes('num') && <TableCell className="text-[var(--portal-text-muted)]">{pageIndex * pageSize + idx + 1}</TableCell>}
                  <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailOrder(o)} title="Подробнее" aria-label="Подробнее о заказе">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  {visibleColumnIds.includes('orderNumber') && <TableCell className="font-mono text-sm text-[var(--portal-text)]">{o.orderNumber}</TableCell>}
                  {visibleColumnIds.includes('tariffId') && <TableCell className="text-[var(--portal-text-muted)]">{o.tariffId}</TableCell>}
                  {visibleColumnIds.includes('amount') && <TableCell className="font-medium text-[var(--portal-text)]">{o.amount} ₽</TableCell>}
                  {visibleColumnIds.includes('clientEmail') && <TableCell className="text-[var(--portal-text-muted)]">{o.clientEmail}</TableCell>}
                    {visibleColumnIds.includes('status') && (
                    <TableCell>
                      <StatusBadge
                        variant={
                          o.status === 'paid' ? 'paid'
                            : o.status === 'refunded' ? 'pending'
                            : o.status === 'cancelled' ? 'pending'
                            : 'pending'
                        }
                        label={
                          o.status === 'paid' ? 'Оплачен'
                            : o.status === 'refunded' ? 'Возврат'
                            : o.status === 'cancelled' ? 'Отменён'
                            : 'Ожидает'
                        }
                      />
                    </TableCell>
                    )}
                  {visibleColumnIds.includes('date') && (
                  <TableCell className="text-[var(--portal-text-muted)]">
                    {o.paidAt ? format(new Date(o.paidAt), 'dd.MM.yyyy HH:mm') : format(new Date(o.createdAt), 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  )}
                  <TableCell onClick={(e) => e.stopPropagation()} className="space-x-1">
                    {o.status !== 'paid' && o.status !== 'cancelled' && o.status !== 'refunded' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConfirm(o.id)}
                        disabled={confirming === o.id}
                      >
                        {confirming === o.id ? '…' : <><Check className="mr-1 h-3 w-3" /> Подтвердить</>}
                      </Button>
                    )}
                    {o.status === 'paid' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-amber-700"
                        onClick={() => setRefundTarget(o)}
                        disabled={refunding}
                      >
                        Возврат
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {detailOrder && (
        <Dialog open={!!detailOrder} onOpenChange={(open) => !open && setDetailOrder(null)}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Заказ {detailOrder.orderNumber}</DialogTitle>
            </DialogHeader>
            <dl className="mt-2 space-y-1 text-sm">
              <div><dt className="text-[var(--portal-text-muted)] inline">Тариф: </dt><dd className="inline">{detailOrder.tariffId}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Сумма: </dt><dd className="inline">{detailOrder.amount} ₽</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Email: </dt><dd className="inline">{detailOrder.clientEmail}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Статус: </dt><dd className="inline">{detailOrder.status}</dd></div>
              <div><dt className="text-[var(--portal-text-muted)] inline">Создан: </dt><dd className="inline">{format(new Date(detailOrder.createdAt), 'dd.MM.yyyy HH:mm')}</dd></div>
              {detailOrder.paidAt && <div><dt className="text-[var(--portal-text-muted)] inline">Оплачен: </dt><dd className="inline">{format(new Date(detailOrder.paidAt), 'dd.MM.yyyy HH:mm')}</dd></div>}
              {detailOrder.userId && (
                <div>
                  <dt className="text-[var(--portal-text-muted)] inline">Пользователь: </dt>
                  <dd className="inline">
                    <Link href={`/portal/admin/users/${detailOrder.userId}`} className="text-[var(--portal-accent)] hover:underline">Карточка пользователя</Link>
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {detailOrder.status !== 'paid' && detailOrder.status !== 'cancelled' && detailOrder.status !== 'refunded' && (
                <Button size="sm" variant="secondary" onClick={() => handleConfirm(detailOrder.id)} disabled={confirming === detailOrder.id}>
                  <Check className="mr-1 h-4 w-4" /> Подтвердить оплату
                </Button>
              )}
              {detailOrder.status === 'paid' && (
                <Button size="sm" variant="secondary" className="text-amber-700" onClick={() => setRefundTarget(detailOrder)} disabled={refunding}>
                  Оформить возврат
                </Button>
              )}
              {detailOrder.status !== 'cancelled' && detailOrder.status !== 'refunded' && (
                <Button size="sm" variant="secondary" className="text-red-600" onClick={() => setCancelTarget(detailOrder)} disabled={cancelling}>
                  <Ban className="mr-1 h-4 w-4" /> Отменить заказ
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Отменить заказ?"
        description={cancelTarget ? `Заказ ${cancelTarget.orderNumber} будет отменён. Покупатель не получит доступ.` : ''}
        confirmLabel="Отменить"
        variant="danger"
        onConfirm={() => { if (cancelTarget) void handleCancel(cancelTarget); }}
      />

      <ConfirmDialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        title="Оформить возврат?"
        description={refundTarget ? `Заказ ${refundTarget.orderNumber}: доступ к курсу будет отозван. Возврат средств выполните в личном кабинете PayKeeper.` : ''}
        confirmLabel="Оформить возврат"
        variant="danger"
        onConfirm={() => { if (refundTarget) void handleRefund(refundTarget); }}
      />

      {sorted.length > 0 && (
        <TablePagination
          currentPage={pageIndex}
          totalPages={totalPages}
          total={sorted.length}
          pageSize={pageSize}
          pageSizeOptions={STANDARD_PAGE_SIZES}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          onExportExcel={handleExportExcel}
          exportLabel="Excel"
          columnConfig={PAYMENTS_TABLE_COLUMNS}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={setVisibleColumnIds}
        />
      )}
    </div>
  );
}
