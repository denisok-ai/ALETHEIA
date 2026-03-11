/**
 * GET: fetch one ticket (student: own, manager: any). PATCH: update status / assign manager (manager or admin).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export interface TicketMessage {
  role: 'user' | 'manager';
  content: string;
  at: string;
}

function parseMessages(raw: string): TicketMessage[] {
  try {
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr)
      ? arr.filter(
          (m): m is TicketMessage =>
            typeof m === 'object' &&
            m !== null &&
            (m as TicketMessage).role in { user: 1, manager: 1 } &&
            typeof (m as TicketMessage).content === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
      manager: { select: { id: true, email: true, profile: { select: { displayName: true } } } },
    },
  });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (ticket.userId !== userId && role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      userId: ticket.userId,
      managerId: ticket.managerId,
      userDisplayName: ticket.user.profile?.displayName ?? ticket.user.email ?? ticket.userId.slice(0, 8),
      managerDisplayName: ticket.manager?.profile?.displayName ?? ticket.manager?.email ?? null,
      messages: parseMessages(ticket.messages),
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { status?: string; managerId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  const data: { status?: string; managerId?: string | null } = {};
  if (typeof body.status === 'string' && allowedStatuses.includes(body.status)) {
    data.status = body.status;
  }
  if (body.managerId !== undefined) {
    data.managerId = body.managerId === '' || body.managerId === null ? null : body.managerId;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ticket: ticket });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    ticket: {
      id: updated.id,
      status: updated.status,
      managerId: updated.managerId,
    },
  });
}
