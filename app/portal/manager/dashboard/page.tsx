/**
 * Manager dashboard: my tickets, active students.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';

export default async function ManagerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Дашборд менеджера</h1>
        <p className="mt-2 text-text-muted">База данных недоступна.</p>
      </div>
    );
  }

  const [openTickets, pendingVerifications, recentTickets] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.phygitalVerification.count({ where: { status: 'pending' } }),
    prisma.ticket.findMany({
      select: { id: true, subject: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Дашборд' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Дашборд менеджера</h1>
      <p className="mt-1 text-text-muted">Тикеты и активные студенты</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/manager/tickets"
          className="rounded-xl border border-border bg-white p-4 transition hover:shadow-md"
        >
          <p className="text-sm text-text-muted">Открытых тикетов</p>
          <p className="text-2xl font-bold text-dark">{openTickets}</p>
        </Link>
        <Link
          href="/portal/manager/verifications"
          className="rounded-xl border border-border bg-white p-4 transition hover:shadow-md"
        >
          <p className="text-sm text-text-muted">На верификации</p>
          <p className="text-2xl font-bold text-dark">{pendingVerifications}</p>
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-dark">Последние тикеты</h2>
        <ul className="mt-3 space-y-2">
          {recentTickets.map((t) => (
            <li key={t.id}>
              <Link
                href="/portal/manager/tickets"
                className="block rounded-lg border border-border bg-white p-3 hover:bg-bg-cream"
              >
                <span className="font-medium text-dark">{t.subject}</span>
                <span className="ml-2 text-xs text-text-muted">{t.status}</span>
                <time className="ml-2 text-xs text-text-soft">
                  {new Date(t.createdAt).toLocaleString('ru')}
                </time>
              </Link>
            </li>
          ))}
        </ul>
        {recentTickets.length === 0 && (
          <p className="mt-2 text-text-muted">Нет тикетов.</p>
        )}
      </section>
    </div>
  );
}
