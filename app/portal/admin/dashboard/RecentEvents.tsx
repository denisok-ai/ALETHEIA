'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatPersonName } from '@/lib/format-person-name';

function formatEventAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'dd.MM.yyyy HH:mm', { locale: ru });
  } catch {
    return '—';
  }
}

export type EventItem =
  | { type: 'payment'; id: number; orderNumber: string; amount: number; email: string; at: string }
  | { type: 'lead'; id: number; name: string; phone: string; at: string }
  | { type: 'user'; id: string; email: string; at: string };

export function RecentEvents({ events }: { events: EventItem[] }) {
  const sorted = [...events].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10);

  if (sorted.length === 0) {
    return (
      <div className="mt-8 portal-card p-6">
        <h2 className="text-lg font-semibold text-[var(--portal-text)]">Последние события</h2>
        <p className="mt-2 text-sm text-[var(--portal-text-muted)]">Нет событий</p>
      </div>
    );
  }

  return (
    <div className="mt-8 portal-card p-6">
      <h2 className="text-lg font-semibold text-[var(--portal-text)]">Последние события</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2E8F0] text-left text-[var(--portal-text-muted)]">
              <th className="pb-2 pr-4 font-medium">Тип</th>
              <th className="pb-2 pr-4 font-medium">Детали</th>
              <th className="pb-2 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={`${e.type}-${'id' in e ? e.id : ''}`} className="border-b border-[#E2E8F0]/50">
                <td className="py-2 pr-4">
                  {e.type === 'payment' && <span className="text-[#6366F1]">Оплата</span>}
                  {e.type === 'lead' && <span className="text-amber-700">Лид</span>}
                  {e.type === 'user' && <span className="text-green-700">Регистрация</span>}
                </td>
                <td className="py-2 pr-4">
                  {e.type === 'payment' && (
                    <Link href="/portal/admin/payments" className="text-[#6366F1] hover:underline">
                      {e.orderNumber} — {e.amount.toLocaleString('ru')} ₽ · {e.email}
                    </Link>
                  )}
                  {e.type === 'lead' && (
                    <Link href="/portal/admin/crm" className="text-[#6366F1] hover:underline">
                      {formatPersonName(e.name)} · {e.phone}
                    </Link>
                  )}
                  {e.type === 'user' && (
                    <Link href={`/portal/admin/users/${e.id}`} className="text-[#6366F1] hover:underline">
                      {e.email}
                    </Link>
                  )}
                </td>
                <td className="py-2 text-[var(--portal-text-muted)]">{formatEventAt(e.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
