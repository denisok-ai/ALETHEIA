/**
 * Admin: update (PATCH) or delete (DELETE) enrollment.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: { accessClosed?: boolean; completedAt?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const enrollment = await prisma.enrollment.findUnique({ where: { id } });
  if (!enrollment) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

  const data: { accessClosed?: boolean; completedAt?: Date | null } = {};
  if (body.accessClosed !== undefined) data.accessClosed = body.accessClosed;
  if (body.completedAt !== undefined) data.completedAt = body.completedAt ? new Date(body.completedAt) : null;

  if (Object.keys(data).length === 0) return NextResponse.json(enrollment, { status: 200 });

  const updated = await prisma.enrollment.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'enrollment.update',
    entity: 'Enrollment',
    entityId: id,
    diff: data,
  });

  return NextResponse.json({
    id: updated.id,
    accessClosed: updated.accessClosed,
    completedAt: updated.completedAt?.toISOString() ?? null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    select: { id: true, userId: true, courseId: true },
  });
  if (!enrollment) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });

  await prisma.enrollment.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'enrollment.delete',
    entity: 'Enrollment',
    entityId: id,
    diff: { userId: enrollment.userId, courseId: enrollment.courseId },
  });

  return NextResponse.json({ success: true });
}
