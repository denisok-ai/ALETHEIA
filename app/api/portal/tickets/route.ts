/**
 * Student: create support ticket.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!subject) {
    return NextResponse.json({ error: 'Укажите тему обращения' }, { status: 400 });
  }

  const messages = message ? [{ role: 'user' as const, content: message, at: new Date().toISOString() }] : [];

  const ticket = await prisma.ticket.create({
    data: {
      userId,
      subject,
      messages: JSON.stringify(messages),
    },
  });

  return NextResponse.json({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      created_at: ticket.createdAt.toISOString(),
    },
  });
}
