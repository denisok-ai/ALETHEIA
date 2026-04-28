'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/SearchInput';
import { toast } from 'sonner';
import { format } from 'date-fns';

type LogRow = {
  id: string;
  direction: string;
  event: string;
  status: string;
  orderNumber: string | null;
  message: string | null;
  createdAt: string;
};

export function PaykeeperLogsClient() {
  const [event, setEvent] = useState('');
  const [status, setStatus] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (event.trim()) q.set('event', event.trim());
      if (status.trim()) q.set('status', status.trim());
      if (orderNumber.trim()) q.set('orderNumber', orderNumber.trim());
      q.set('limit', '80');
      const res = await fetch(`/api/portal/admin/paykeeper/logs?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка');
      setLogs(data.logs ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SearchInput
          onSearch={setEvent}
          placeholder="Событие (часть event)…"
          wrapperClassName="max-w-xs"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="paykeeper-logs-status" className="text-xs text-[var(--portal-text-muted)]">
            Статус
          </label>
          <select
            id="paykeeper-logs-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
          >
            <option value="">Все</option>
            <option value="success">success</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
          </select>
        </div>
        <SearchInput
          onSearch={setOrderNumber}
          placeholder="№ заказа"
          wrapperClassName="max-w-xs"
        />
        <Button size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? '…' : 'Показать'}
        </Button>
      </div>
      <div className="portal-card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <tr>
              <th className="p-2">Время</th>
              <th className="p-2">Напр.</th>
              <th className="p-2">Событие</th>
              <th className="p-2">Статус</th>
              <th className="p-2">Заказ</th>
              <th className="p-2">Сообщение</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((r) => (
              <tr key={r.id} className="border-b border-[#F1F5F9]">
                <td className="p-2 whitespace-nowrap text-[var(--portal-text-muted)]">
                  {format(new Date(r.createdAt), 'dd.MM.yy HH:mm:ss')}
                </td>
                <td className="p-2">{r.direction}</td>
                <td className="p-2 font-mono text-xs">{r.event}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2 font-mono text-xs">{r.orderNumber ?? '—'}</td>
                <td className="p-2 max-w-md truncate" title={r.message ?? ''}>
                  {r.message ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && !loading && (
          <p className="p-6 text-sm text-[var(--portal-text-muted)]">Нет записей — нажмите «Показать».</p>
        )}
      </div>
    </div>
  );
}
