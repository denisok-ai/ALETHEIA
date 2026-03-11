/**
 * Admin: create enrollment (register user on course).
 * POST body: { userId, courseId }
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { triggerNotification } from '@/lib/notifications';
import { writeAuditLog } from '@/lib/audit';
import { enrollmentCreateSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = enrollmentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { userId, courseId } = parsed.data;

  const [user, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
  ]);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) {
    return NextResponse.json({ error: 'User already enrolled' }, { status: 409 });
  }

  const enrollment = await prisma.enrollment.create({
    data: { userId, courseId },
  });

  await triggerNotification({
    eventType: 'enrollment',
    userId,
    metadata: { objectname: course.title },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'enrollment.create',
    entity: 'Enrollment',
    entityId: enrollment.id,
    diff: { userId, courseId },
  });

  return NextResponse.json({
    id: enrollment.id,
    userId: enrollment.userId,
    courseId: enrollment.courseId,
    enrolledAt: enrollment.enrolledAt.toISOString(),
  });
}
