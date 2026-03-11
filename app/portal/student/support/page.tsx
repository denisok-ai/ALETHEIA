/**
 * Student: support tickets — list and create.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Breadcrumbs } from '@/components/portal/Breadcrumbs';
import { SupportTicketsClient } from './SupportTicketsClient';

export default async function StudentSupportPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div>
        <h1 className="font-heading text-2xl font-bold text-dark">Поддержка</h1>
        <p className="mt-2 text-text-muted">Загрузка…</p>
      </div>
    );
  }

  const tickets = await prisma.ticket.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const initialTickets = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    created_at: t.createdAt.toISOString(),
  }));

  return (
    <div>
      <Breadcrumbs items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Поддержка' }]} />
      <h1 className="mt-2 font-heading text-2xl font-bold text-dark">Поддержка</h1>
      <p className="mt-1 text-text-muted">Ваши обращения и заявки</p>
      <SupportTicketsClient initialTickets={initialTickets} />
    </div>
  );
}
