/**
 * Admin: list notification logs with optional filters.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get('eventType')?.trim();
  const channel = searchParams.get('channel')?.trim();
  const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);

  const where: { eventType?: string; channel?: string } = {};
  if (eventType) where.eventType = eventType;
  if (channel) where.channel = channel;

  const logs = await prisma.notificationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      userEmail: l.user?.email ?? null,
      userDisplayName: l.user?.profile?.displayName ?? null,
      eventType: l.eventType,
      subject: l.subject,
      content: l.content,
      channel: l.channel,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
