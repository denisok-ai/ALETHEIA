/**
 * Admin: get mailing logs (GET).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const mailing = await prisma.mailing.findUnique({ where: { id } });
  if (!mailing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const logs = await prisma.mailingLog.findMany({
    where: { mailingId: id },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      recipientEmail: l.recipientEmail,
      recipientName: l.recipientName,
      status: l.status,
      errorMessage: l.errorMessage,
      sentAt: l.sentAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    startedAt: mailing.startedAt?.toISOString() ?? null,
    completedAt: mailing.completedAt?.toISOString() ?? null,
  });
}
