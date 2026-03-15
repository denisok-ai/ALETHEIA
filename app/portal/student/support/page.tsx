/**
 * Student: support tickets — list and create.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';

export const metadata: Metadata = { title: 'Поддержка' };

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/portal/PageHeader';
import { SupportTicketsClient } from './SupportTicketsClient';

export default async function StudentSupportPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) {
    return (
      <div className="w-full">
        <PageHeader
          items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Поддержка' }]}
          title="Поддержка"
          description="Загрузка…"
        />
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
    <div className="w-full space-y-4">
      <PageHeader
        items={[{ href: '/portal/student/dashboard', label: 'Дашборд' }, { label: 'Поддержка' }]}
        title="Поддержка"
        description="Ваши обращения и заявки"
      />
      <SupportTicketsClient initialTickets={initialTickets} />
    </div>
  );
}
