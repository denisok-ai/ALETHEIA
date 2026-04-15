/**
 * Manager dashboard: tickets and verifications. Portal design.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ManagerDashboardView } from './ManagerDashboardView';

export const metadata: Metadata = { title: 'Дашборд' };

export default async function ManagerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return (
      <div className="portal-card p-6 max-w-2xl">
        <p className="text-[var(--portal-text-muted)]">База данных недоступна.</p>
      </div>
    );
  }
  const role = (session.user as { role?: string })?.role;
  if (role !== 'manager' && role !== 'admin') notFound();

  const [openTickets, pendingVerifications, recentTickets] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
    prisma.phygitalVerification.count({ where: { status: 'pending' } }),
    prisma.ticket.findMany({
      select: { id: true, subject: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const recentSerialized = recentTickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <ManagerDashboardView
      openTickets={openTickets}
      pendingVerifications={pendingVerifications}
      recentTickets={recentSerialized}
    />
  );
}
