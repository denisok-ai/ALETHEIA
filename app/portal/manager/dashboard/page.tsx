/**
 * Manager dashboard: tickets and verifications. Portal design.
 */
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react';

export default async function ManagerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">База данных недоступна.</p>
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

  const STATUS_MAP: Record<string, string> = {
    open: 'badge-warn',
    in_progress: 'badge-info',
    resolved: 'badge-active',
    closed: 'badge-neutral',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        items={[{ label: 'Дашборд' }]}
        title="Дашборд"
        description="Тикеты и верификация заданий"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/portal/manager/tickets"
          className="portal-card flex items-center gap-4 p-5 hover:shadow-[var(--portal-shadow)] transition-shadow"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
            <MessageSquare className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">Открытых тикетов</p>
            <p className="text-2xl font-bold text-[var(--portal-text)]">{openTickets}</p>
          </div>
          <span className="ml-auto text-[var(--portal-text-soft)]"><ArrowRight className="h-4 w-4" /></span>
        </Link>
        <Link
          href="/portal/manager/verifications"
          className="portal-card flex items-center gap-4 p-5 hover:shadow-[var(--portal-shadow)] transition-shadow"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#1D4ED8]">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--portal-text-muted)]">На верификации</p>
            <p className="text-2xl font-bold text-[var(--portal-text)]">{pendingVerifications}</p>
          </div>
          <span className="ml-auto text-[var(--portal-text-soft)]"><ArrowRight className="h-4 w-4" /></span>
        </Link>
      </div>

      <section>
        <h2 className="text-base font-semibold text-[var(--portal-text)] mb-3">Последние тикеты</h2>
        {recentTickets.length === 0 ? (
          <div className="portal-card p-8 text-center">
            <p className="text-sm text-[var(--portal-text-muted)]">Нет тикетов</p>
            <Link href="/portal/manager/tickets" className="mt-3 inline-block text-sm font-medium text-[#6366F1] hover:underline">
              Перейти к тикетам →
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {recentTickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/portal/manager/tickets/${t.id}`}
                  className="portal-card flex items-center justify-between gap-4 p-4 hover:shadow-[var(--portal-shadow)] transition-shadow"
                >
                  <span className="font-medium text-[var(--portal-text)] truncate">{t.subject}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`status-badge ${STATUS_MAP[t.status] ?? 'badge-neutral'}`}>
                      {t.status === 'open' ? 'Открыт' : t.status === 'in_progress' ? 'В работе' : t.status === 'resolved' ? 'Решён' : 'Закрыт'}
                    </span>
                    <time className="text-xs text-[var(--portal-text-soft)]">
                      {new Date(t.createdAt).toLocaleString('ru', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <ArrowRight className="h-4 w-4 text-[var(--portal-text-soft)]" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {recentTickets.length > 0 && (
          <p className="mt-3">
            <Link href="/portal/manager/tickets" className="text-sm font-medium text-[#6366F1] hover:underline">
              Все тикеты →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
