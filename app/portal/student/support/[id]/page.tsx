/**
 * Student: ticket thread — view messages, reply.
 */
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TicketThread } from '@/components/portal/TicketThread';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const { id } = await params;
  if (!userId) return { title: 'Обращение' };
  const ticket = await prisma.ticket.findUnique({
    where: { id, userId },
    select: { subject: true },
  });
  if (!ticket) return { title: 'Обращение' };
  const title = ticket.subject?.trim() || 'Обращение';
  return { title: title.length > 50 ? title.slice(0, 47) + '…' : title };
}

export default async function StudentSupportTicketPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) notFound();

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id, userId },
    include: {
      user: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      manager: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
    },
  });
  if (!ticket) notFound();

  const messages: { role: string; content: string; at: string }[] = (() => {
    try {
      const arr = JSON.parse(ticket.messages) as unknown[];
      return Array.isArray(arr)
        ? arr.filter(
            (m): m is { role: string; content: string; at: string } =>
              typeof m === 'object' && m !== null && typeof (m as { content: string }).content === 'string'
          )
        : [];
    } catch {
      return [];
    }
  })();

  return (
    <div>
      <TicketThread
        ticketId={ticket.id}
        subject={ticket.subject}
        status={ticket.status}
        managerId={ticket.managerId}
        userDisplayName={ticket.user.profile?.displayName ?? ticket.user.email ?? ticket.userId.slice(0, 8)}
        managerDisplayName={ticket.manager?.profile?.displayName ?? ticket.manager?.email ?? null}
        initialMessages={messages}
        backHref="/portal/student/support"
        backLabel="← К моим обращениям"
      />
    </div>
  );
}
