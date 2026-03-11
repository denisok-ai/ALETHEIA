/**
 * Admin: list courses in group (GET), add course (POST), remove course (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assignCourseSchema } from '@/lib/validations/group';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const group = await prisma.group.findUnique({
    where: { id: groupId, moduleType: 'course' },
    include: {
      courseGroups: {
        include: { course: { select: { id: true, title: true, status: true } } },
      },
    },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    courses: group.courseGroups.map((cg) => ({
      id: cg.course.id,
      title: cg.course.title,
      status: cg.course.status,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const group = await prisma.group.findUnique({
    where: { id: groupId, moduleType: 'course' },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = assignCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'courseId required' }, { status: 400 });
  }

  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 404 });

  await prisma.courseGroup.upsert({
    where: { courseId_groupId: { courseId: course.id, groupId } },
    create: { courseId: course.id, groupId },
    update: {},
  });

  return NextResponse.json({ ok: true, courseId: course.id, groupId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const courseId = request.nextUrl.searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });

  await prisma.courseGroup.deleteMany({
    where: { groupId, courseId },
  });
  return NextResponse.json({ ok: true });
}
