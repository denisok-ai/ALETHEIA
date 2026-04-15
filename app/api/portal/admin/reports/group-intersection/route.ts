/**
 * Admin: зачисления на пересечении группы пользователей и группы курсов за период.
 * Query: dateFrom, dateTo, userGroupId, courseGroupId (все обязательны).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseReportPeriod } from '@/lib/reports';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const userGroupId = sp.get('userGroupId')?.trim();
  const courseGroupId = sp.get('courseGroupId')?.trim();
  if (!userGroupId || !courseGroupId) {
    return NextResponse.json(
      { error: 'Укажите userGroupId и courseGroupId' },
      { status: 400 }
    );
  }

  const { dateFrom, dateTo } = parseReportPeriod(sp);

  const [userIdsInGroup, courseIdsInGroup] = await Promise.all([
    prisma.userGroup.findMany({
      where: { groupId: userGroupId },
      select: { userId: true },
    }),
    prisma.courseGroup.findMany({
      where: { groupId: courseGroupId },
      select: { courseId: true },
    }),
  ]);

  const userSet = new Set(userIdsInGroup.map((u) => u.userId));
  const courseSet = new Set(courseIdsInGroup.map((c) => c.courseId));

  if (userSet.size === 0 || courseSet.size === 0) {
    return NextResponse.json({
      period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
      userGroupId,
      courseGroupId,
      rows: [],
    });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: { in: Array.from(userSet) },
      courseId: { in: Array.from(courseSet) },
      enrolledAt: { gte: dateFrom, lte: dateTo },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      course: { select: { id: true, title: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const rows = enrollments.map((e) => ({
    userId: e.userId,
    displayName: e.user.profile?.displayName || e.user.email || '—',
    email: e.user.email ?? '',
    courseId: e.courseId,
    courseTitle: e.course.title,
    enrolledAt: e.enrolledAt.toISOString(),
    completedAt: e.completedAt?.toISOString() ?? null,
    accessClosed: e.accessClosed,
  }));

  return NextResponse.json({
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    userGroupId,
    courseGroupId,
    rows,
  });
}
