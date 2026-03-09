/**
 * Manager dashboard: my tickets, active students.
 */
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function ManagerDashboardPage() {
  const supabase = createClient();
  if (!supabase) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Дашборд менеджера</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const [
    { count: openTickets },
    { count: pendingVerifications },
    { data: recentTickets },
  ] = await Promise.all([
    supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('phygital_verifications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('tickets').select('id, subject, status, created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-dark">Дашборд менеджера</h1>
      <p className="mt-1 text-text-muted">Тикеты и активные студенты</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/manager/tickets"
          className="rounded-xl border border-border bg-white p-4 transition hover:shadow-md"
        >
          <p className="text-sm text-text-muted">Открытых тикетов</p>
          <p className="text-2xl font-bold text-dark">{openTickets ?? 0}</p>
        </Link>
        <Link
          href="/portal/manager/verifications"
          className="rounded-xl border border-border bg-white p-4 transition hover:shadow-md"
        >
          <p className="text-sm text-text-muted">На верификации</p>
          <p className="text-2xl font-bold text-dark">{pendingVerifications ?? 0}</p>
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Последние тикеты</h2>
        <ul className="mt-3 space-y-2">
          {(recentTickets ?? []).map((t) => (
            <li key={(t as { id: string }).id}>
              <Link
                href="/portal/manager/tickets"
                className="block rounded-lg border border-border bg-white p-3 hover:bg-bg-cream"
              >
                <span className="font-medium text-dark">{(t as { subject: string }).subject}</span>
                <span className="ml-2 text-xs text-text-muted">{(t as { status: string }).status}</span>
                <time className="ml-2 text-xs text-text-soft">
                  {new Date((t as { created_at: string }).created_at).toLocaleString('ru')}
                </time>
              </Link>
            </li>
          ))}
        </ul>
        {(recentTickets ?? []).length === 0 && (
          <p className="mt-2 text-text-muted">Нет тикетов.</p>
        )}
      </section>
    </div>
  );
}
