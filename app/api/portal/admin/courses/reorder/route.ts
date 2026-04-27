/**
 * Admin: reorder courses. POST body { courseIds: string[] } — sets sortOrder by index.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { courseIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const courseIds = body.courseIds;
  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return NextResponse.json({ error: 'courseIds array required' }, { status: 400 });
  }

  await prisma.$transaction(
    courseIds.map((id, index) =>
      prisma.course.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  await writeAuditLog({
    actorId: auth.userId,
    action: 'course.reorder',
    entity: 'Course',
    diff: { courseIds },
  });

  return NextResponse.json({ success: true });
}
