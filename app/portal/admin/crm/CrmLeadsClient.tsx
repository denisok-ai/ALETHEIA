'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Lead {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: string;
  converted_to_user_id: string | null;
  created_at: string;
}

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;

export function CrmLeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [converting, setConverting] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConvert(leadId: number) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
    setUpdating(null);
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-soft">
              <th className="px-4 py-3 font-medium text-dark">Дата</th>
              <th className="px-4 py-3 font-medium text-dark">Имя</th>
              <th className="px-4 py-3 font-medium text-dark">Телефон</th>
              <th className="px-4 py-3 font-medium text-dark">Email</th>
              <th className="px-4 py-3 font-medium text-dark">Статус</th>
              <th className="px-4 py-3 font-medium text-dark">Сообщение</th>
              <th className="px-4 py-3 font-medium text-dark">Действия</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-border hover:bg-bg-cream">
                <td className="px-4 py-3 text-text-muted">
                  {new Date(l.created_at).toLocaleDateString('ru')}
                </td>
                <td className="px-4 py-3 font-medium text-dark">{l.name}</td>
                <td className="px-4 py-3 text-text-muted">{l.phone}</td>
                <td className="px-4 py-3 text-text-muted">{l.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={l.status}
                    onChange={(e) => handleStatusChange(l.id, e.target.value)}
                    disabled={updating === l.id}
                    className="rounded border border-border bg-white px-2 py-1 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-text-muted">
                  {l.message ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {l.converted_to_user_id ? (
                    <span className="text-xs text-green-600">Конвертирован</span>
                  ) : l.email ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleConvert(l.id)}
                      disabled={converting === l.id}
                    >
                      {converting === l.id ? '…' : 'Конвертировать'}
                    </Button>
                  ) : (
                    <span className="text-xs text-text-muted">Нет email</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leads.length === 0 && (
        <p className="mt-4 text-center text-text-muted">Нет лидов.</p>
      )}
    </div>
  );
}
