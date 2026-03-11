'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const PERIODS = [7, 30, 90] as const;

interface DayData {
  date: string;
  revenue: number;
  count: number;
}

interface ActivityDayData {
  date: string;
  enrollments: number;
  certificates: number;
}

export function DashboardCharts({
  revenueData,
  activityData,
}: {
  revenueData: DayData[];
  activityData: ActivityDayData[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const period = Math.min(90, Math.max(7, Number(searchParams.get('period')) || 30));
  const periodParam = PERIODS.includes(period as 7 | 30 | 90) ? period : 30;

  function setPeriod(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('period', String(p));
    router.push(`/portal/admin/dashboard?${next.toString()}`);
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/portal/manager/tickets"
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-bg-soft"
        >
          Открытые тикеты
        </Link>
        <Link
          href="/portal/admin/crm?status=new"
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-bg-soft"
        >
          Новые лиды
        </Link>
        <Link
          href="/portal/admin/payments"
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-dark hover:bg-bg-soft"
        >
          Оплаты и экспорт
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-white p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-dark">Выручка по дням</h2>
          <div className="flex rounded-lg border border-border p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  periodParam === p ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-soft hover:text-dark'
                }`}
              >
                {p} дн.
              </button>
            ))}
          </div>
        </div>
        {revenueData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Number(v ?? 0)} ₽`} />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0).toLocaleString('ru')} ₽`]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="revenue" fill="#2D1B4E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Нет данных за период</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold text-dark">Активность по дням (записи и сертификаты)</h2>
        {activityData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(label) => label} />
                <Legend />
                <Line type="monotone" dataKey="enrollments" stroke="#2D1B4E" name="Записи на курсы" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="certificates" stroke="#D4AF37" name="Сертификаты" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">Нет данных за период</p>
        )}
      </div>
    </>
  );
}
