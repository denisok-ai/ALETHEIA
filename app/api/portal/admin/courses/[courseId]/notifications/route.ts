/**
 * Admin: list notification sets attached to a course; attach new sets.
 * GET – список наборов уведомлений, прикреплённых к мероприятию.
 * POST – прикрепить набор(ы) к мероприятию.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const links = await prisma.courseNotificationSet.findMany({
    where: { courseId },
    include: {
      notificationSet: { select: { id: true, eventType: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const sets = links.map((l) => ({
    id: l.id,
    notificationSetId: l.notificationSet.id,
    eventType: l.notificationSet.eventType,
    name: l.notificationSet.name,
  }));

  return NextResponse.json({ sets });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  let body: { notificationSetIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const ids = Array.isArray(body.notificationSetIds) ? body.notificationSetIds.filter((id) => typeof id === 'string') : [];
  if (ids.length === 0) return NextResponse.json({ error: 'notificationSetIds required (array)' }, { status: 400 });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const existing = await prisma.courseNotificationSet.findMany({
    where: { courseId },
    select: { notificationSetId: true },
  });
  const existingSetIds = new Set(existing.map((e) => e.notificationSetId));
  const toAdd = ids.filter((id) => !existingSetIds.has(id));

  if (toAdd.length === 0) {
    return NextResponse.json({ attached: 0, message: 'All sets already attached' });
  }

  await prisma.courseNotificationSet.createMany({
    data: toAdd.map((notificationSetId) => ({ courseId, notificationSetId })),
  });

  return NextResponse.json({ attached: toAdd.length });
}
