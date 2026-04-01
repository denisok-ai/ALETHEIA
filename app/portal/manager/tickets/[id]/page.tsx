/**
 * Manager: ticket thread — messages, reply, status, assign.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TicketThread } from '@/components/portal/TicketThread';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { subject: true },
  });
  if (!ticket) return { title: 'Тикет' };
  const title = ticket.subject?.trim() || 'Тикет';
  return { title: title.length > 50 ? title.slice(0, 47) + '…' : title };
}

export default async function ManagerTicketPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId || (role !== 'manager' && role !== 'admin')) notFound();

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      manager: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
    },
  });
  if (!ticket) notFound();

  const managers = await prisma.profile.findMany({
    where: { role: 'manager', status: 'active' },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { displayName: 'asc' },
  });

  const messages: { role: string; content: string; at: string }[] = (() => {
    try {
      const arr = JSON.parse(ticket.messages) as unknown[];
      return Array.isArray(arr) ? arr.filter((m): m is { role: string; content: string; at: string } => typeof m === 'object' && m !== null && typeof (m as { content: string }).content === 'string') : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-6">
      <TicketThread
        ticketId={ticket.id}
        subject={ticket.subject}
        status={ticket.status}
        managerId={ticket.managerId}
        orderNumber={ticket.orderNumber}
        canLinkOrderToPayments={role === 'admin'}
        userDisplayName={ticket.user.profile?.displayName ?? ticket.user.email ?? ticket.userId.slice(0, 8)}
        managerDisplayName={ticket.manager?.profile?.displayName ?? ticket.manager?.email ?? null}
        initialMessages={messages}
        canChangeStatus
        canAssign
        canAddToKb={role === 'admin'}
        managers={managers.map((p) => ({ id: p.userId, label: p.displayName ?? p.user.email ?? p.userId.slice(0, 8) }))}
        backHref="/portal/manager/tickets"
        backLabel="← К списку тикетов"
        layout="wide"
      />
    </div>
  );
}
