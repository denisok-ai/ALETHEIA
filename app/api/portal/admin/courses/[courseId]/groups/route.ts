/**
 * Admin: list groups this course belongs to (GET), add to group (POST), remove from group (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      courseGroups: {
        include: { group: { select: { id: true, name: true, parentId: true } } },
      },
    },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    groups: course.courseGroups.map((cg) => ({
      id: cg.group.id,
      name: cg.group.name,
      parentId: cg.group.parentId,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  let body: { groupId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const groupId = body.groupId?.trim();
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  const [course, group] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.group.findUnique({ where: { id: groupId, moduleType: 'course' } }),
  ]);
  if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 404 });
  if (!group) return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 });

  await prisma.courseGroup.upsert({
    where: { courseId_groupId: { courseId, groupId } },
    create: { courseId, groupId },
    update: {},
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  const groupId = request.nextUrl.searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  await prisma.courseGroup.deleteMany({ where: { courseId, groupId } });
  return NextResponse.json({ ok: true });
}
