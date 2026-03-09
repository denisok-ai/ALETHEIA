/**
 * Admin dashboard: real metrics from DB, revenue chart.
 */
import { createClient } from '@/lib/supabase/server';
import { RevenueChart } from './RevenueChart';

export default async function AdminDashboardPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Дашборд администратора</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { count: usersCount },
    { count: coursesCount },
    { data: paidOrders },
    { data: paidOrdersByDay },
    { count: ticketsCount },
    { count: leadsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('amount').eq('status', 'paid').gte('paid_at', monthStart),
    supabase.from('orders').select('amount, paid_at').eq('status', 'paid').gte('paid_at', thirtyDaysAgo.toISOString()),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
  ]);

  const revenueMonth = (paidOrders ?? []).reduce((s, o) => s + ((o as { amount?: number }).amount ?? 0), 0);

  const byDay = (paidOrdersByDay ?? []).reduce(
    (acc, o) => {
      const d = (o as { paid_at?: string }).paid_at?.slice(0, 10) ?? '';
      if (!d) return acc;
      if (!acc[d]) acc[d] = { revenue: 0, count: 0 };
      acc[d].revenue += (o as { amount?: number }).amount ?? 0;
      acc[d].count += 1;
      return acc;
    },
    {} as Record<string, { revenue: number; count: number }>
  );

  const chartData: { date: string; revenue: number; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    chartData.push({
      date: key,
      revenue: byDay[key]?.revenue ?? 0,
      count: byDay[key]?.count ?? 0,
    });
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Дашборд администратора</h1>
      <p className="mt-1 text-text-muted">Обзор системы и метрики</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Активных пользователей</p>
          <p className="text-2xl font-bold text-dark">{usersCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Курсов</p>
          <p className="text-2xl font-bold text-dark">{coursesCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Выручка (мес.)</p>
          <p className="text-2xl font-bold text-dark">{revenueMonth.toLocaleString('ru')} ₽</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Открытых тикетов</p>
          <p className="text-2xl font-bold text-dark">{ticketsCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-text-muted">Новых лидов</p>
          <p className="text-2xl font-bold text-dark">{leadsCount ?? 0}</p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-white p-6">
        <h2 className="text-lg font-semibold text-dark">Выручка по дням (30 дней)</h2>
        <RevenueChart data={chartData} />
      </div>
    </div>
  );
}
