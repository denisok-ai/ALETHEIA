/**
 * POST: add a message to the ticket thread. Role = user if ticket owner, else manager.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface MessageItem {
  role: 'user' | 'manager';
  content: string;
  at: string;
}

function parseMessages(raw: string): MessageItem[] {
  try {
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr)
      ? arr.filter(
          (m): m is MessageItem =>
            typeof m === 'object' && m !== null && typeof (m as MessageItem).content === 'string'
        )
      : [];
  } catch {
    return [];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = ticket.userId === userId;
  const isManagerOrAdmin = role === 'manager' || role === 'admin';
  if (!isOwner && !isManagerOrAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const messageRole: 'user' | 'manager' = isOwner ? 'user' : 'manager';
  const messages = parseMessages(ticket.messages);
  messages.push({ role: messageRole, content, at: new Date().toISOString() });

  await prisma.ticket.update({
    where: { id },
    data: { messages: JSON.stringify(messages), updatedAt: new Date() },
  });

  return NextResponse.json({
    message: { role: messageRole, content, at: messages[messages.length - 1].at },
  });
}
