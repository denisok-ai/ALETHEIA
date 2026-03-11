/**
 * Admin: detach a notification set from a course (Исключить).
 * DELETE /api/portal/admin/courses/[courseId]/notifications/[notificationSetId]
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; notificationSetId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId, notificationSetId } = await params;
  if (!courseId || !notificationSetId) {
    return NextResponse.json({ error: 'Missing courseId or notificationSetId' }, { status: 400 });
  }

  const deleted = await prisma.courseNotificationSet.deleteMany({
    where: { courseId, notificationSetId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
