'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PORTAL_PATH } from '@/lib/portal-paths';
import { formatRub } from '@/lib/format-ru';
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

  const hasRevenue = revenueData.some((d) => d.revenue > 0 || d.count > 0);
  const hasActivity = activityData.some((d) => d.enrollments > 0 || d.certificates > 0);

  function setPeriod(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('period', String(p));
    router.push(`${PORTAL_PATH.adminDashboard}?${next.toString()}`);
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/portal/manager/tickets"
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC]"
        >
          Открытые тикеты
        </Link>
        <Link
          href="/portal/admin/crm?status=new"
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC]"
        >
          Новые лиды
        </Link>
        <Link
          href="/portal/admin/payments"
          className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[var(--portal-text)] hover:bg-[#F8FAFC]"
        >
          Оплаты и экспорт
        </Link>
      </div>

      <div className="mt-8 min-w-0 portal-card p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--portal-text)]">Выручка по дням</h2>
          <div className="flex rounded-lg border border-[#E2E8F0] p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  periodParam === p ? 'bg-[var(--portal-accent)] text-white' : 'text-[var(--portal-text-muted)] hover:bg-[#F1F5F9] hover:text-[var(--portal-text)]'
                }`}
              >
                {p} дн.
              </button>
            ))}
          </div>
        </div>
        {revenueData.length > 0 && hasRevenue ? (
          <div className="h-64 w-full min-h-[256px]" style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
              <BarChart data={revenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${formatRub(Number(v ?? 0))} ₽`} />
                <Tooltip
                  formatter={(value) => [`${formatRub(Number(value ?? 0))} ₽`]}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="revenue" fill="#2D1B4E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--portal-text-muted)]">
              {revenueData.length === 0 ? 'Нет данных за период' : 'Нет оплат за выбранный период'}
            </p>
            <p className="mt-1 text-xs text-[var(--portal-text-soft)]">
              Оплаты появятся после приёма платежей через PayKeeper
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 portal-card p-6">
        <h2 className="mb-3 text-lg font-semibold text-[var(--portal-text)]">Активность по дням (записи и сертификаты)</h2>
        {activityData.length > 0 && hasActivity ? (
          <div className="h-64 w-full min-h-[256px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
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
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--portal-text-muted)]">
              {activityData.length === 0 ? 'Нет данных за период' : 'Нет записей и сертификатов за выбранный период'}
            </p>
            <p className="mt-1 text-xs text-[var(--portal-text-soft)]">
              Записи на курсы и выдача сертификатов появятся по мере активности слушателей
            </p>
          </div>
        )}
      </div>
    </>
  );
}
