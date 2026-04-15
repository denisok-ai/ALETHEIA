/**
 * Mark notification as read (student, own only).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
