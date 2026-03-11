/**
 * Admin: list recent comms sends.
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sends = await prisma.commsSend.findMany({
    orderBy: { sentAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    sends: sends.map((s) => ({
      id: s.id,
      channel: s.channel,
      recipient: s.recipient,
      subject: s.subject,
      status: s.status,
      sentAt: s.sentAt.toISOString(),
    })),
  });
}
