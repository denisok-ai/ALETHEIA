/**
 * Admin: update (PATCH) or delete (DELETE) course.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { courseUpdateSchema } from '@/lib/validations/course';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = courseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.course.findUnique({ where: { id: courseId } });
  if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.price !== undefined) data.price = parsed.data.price;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.thumbnailUrl !== undefined) data.thumbnailUrl = parsed.data.thumbnailUrl?.trim() || null;
  if (parsed.data.sortOrder !== undefined) data.sortOrder = parsed.data.sortOrder;
  if (parsed.data.aiTutorEnabled !== undefined) data.aiTutorEnabled = parsed.data.aiTutorEnabled;
  if (parsed.data.startsAt !== undefined) data.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  if (parsed.data.endsAt !== undefined) data.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (parsed.data.verificationRequiredLessonIds !== undefined) {
    const arr = parsed.data.verificationRequiredLessonIds;
    const normalized = Array.isArray(arr)
      ? arr.map((x) => (typeof x === 'string' ? { lessonId: x } : x))
      : [];
    data.verificationRequiredLessonIds = normalized.length > 0 ? JSON.stringify(normalized) : null;
  }

  const course = await prisma.course.update({
    where: { id: courseId },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'course.update',
    entity: 'Course',
    entityId: courseId,
    diff: data,
  });

  return NextResponse.json({
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
      starts_at: course.startsAt?.toISOString() ?? null,
      ends_at: course.endsAt?.toISOString() ?? null,
      scorm_path: course.scormPath,
      thumbnail_url: course.thumbnailUrl,
      status: course.status,
      price: course.price,
      sort_order: course.sortOrder,
      ai_tutor_enabled: course.aiTutorEnabled,
      verification_required_lesson_ids: course.verificationRequiredLessonIds,
      created_at: course.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });

  const existing = await prisma.course.findUnique({ where: { id: courseId } });
  if (!existing) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  await prisma.course.delete({ where: { id: courseId } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'course.delete',
    entity: 'Course',
    entityId: courseId,
    diff: { title: existing.title },
  });

  return NextResponse.json({ success: true });
}
