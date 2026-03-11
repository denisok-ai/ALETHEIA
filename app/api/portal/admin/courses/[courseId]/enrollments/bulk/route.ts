/**
 * Admin: bulk enroll (POST) or bulk unenroll (DELETE) for a course.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { triggerNotification } from '@/lib/notifications';
import { enrollmentBulkCreateSchema, enrollmentBulkDeleteSchema } from '@/lib/validations/enrollment';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = enrollmentBulkCreateSchema.safeParse({ ...(typeof body === 'object' && body !== null ? body : {}), courseId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let userIds: string[] = [];
  const notFoundInput: string[] = [];
  if (parsed.data.userIds?.length) {
    userIds = parsed.data.userIds;
  } else if (parsed.data.emails?.length) {
    const emails = Array.from(new Set(parsed.data.emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)));
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const foundEmails = new Set(users.map((u) => u.email.toLowerCase()));
    for (const e of emails) {
      if (!foundEmails.has(e)) notFoundInput.push(e);
    }
    userIds = users.map((u) => u.id);
  }

  const existing = await prisma.enrollment.findMany({
    where: { courseId, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingUserIds = new Set(existing.map((e) => e.userId));
  const toEnroll = userIds.filter((id) => !existingUserIds.has(id));

  let enrolled = 0;
  const notFound: string[] = [];
  for (const userId of toEnroll) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      notFound.push(userId);
      continue;
    }
    await prisma.enrollment.create({
      data: { userId, courseId },
    });
    await triggerNotification({
      eventType: 'enrollment',
      userId,
      metadata: { objectname: course.title },
    });
    enrolled++;
  }

  const skipped = userIds.length - toEnroll.length;
  const allNotFound = parsed.data.emails ? notFoundInput : notFound;
  if (enrolled > 0) {
    await writeAuditLog({
      actorId: auth.userId,
      action: 'enrollment.bulk_create',
      entity: 'Enrollment',
      entityId: courseId,
      diff: { courseId, enrolled, skipped, notFoundCount: allNotFound.length },
    });
  }

  return NextResponse.json({
    enrolled,
    skipped,
    notFound: allNotFound.slice(0, 50),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = enrollmentBulkDeleteSchema.safeParse({ ...(typeof body === 'object' && body !== null ? body : {}), courseId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  let deleted = 0;
  if (parsed.data.enrollmentIds?.length) {
    const result = await prisma.enrollment.deleteMany({
      where: { id: { in: parsed.data.enrollmentIds }, courseId },
    });
    deleted = result.count;
  } else if (parsed.data.userIds?.length) {
    const result = await prisma.enrollment.deleteMany({
      where: { userId: { in: parsed.data.userIds }, courseId },
    });
    deleted = result.count;
  }

  if (deleted > 0) {
    await writeAuditLog({
      actorId: auth.userId,
      action: 'enrollment.bulk_delete',
      entity: 'Enrollment',
      entityId: courseId,
      diff: { courseId, deleted },
    });
  }

  return NextResponse.json({ deleted });
}
