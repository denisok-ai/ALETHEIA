/**
 * Student: ticket thread — view messages, reply.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { TicketThread } from '@/components/portal/TicketThread';

export default async function StudentSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
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
