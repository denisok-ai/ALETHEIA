/**
 * Admin: отчёт по курсам — зачислено, завершило, сертификаты, прогресс, время.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseReportPeriod } from '@/lib/reports';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { dateFrom, dateTo } = parseReportPeriod(request.nextUrl.searchParams);
  const statusFilter = request.nextUrl.searchParams.get('status')?.trim(); // published | draft | all

  const courses = await prisma.course.findMany({
    where: statusFilter && statusFilter !== 'all' ? { status: statusFilter } : undefined,
    orderBy: { sortOrder: 'asc', title: 'asc' },
    select: {
      id: true,
      title: true,
      status: true,
      _count: {
        select: {
          enrollments: true,
          certificates: true,
        },
      },
    },
  });

  const courseIds = courses.map((c) => c.id);

  const [completedByCourse, accessOpenByCourse, progressAgg, certsNotRevoked] = await Promise.all([
    prisma.enrollment.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds }, completedAt: { not: null } },
      _count: true,
    }),
    prisma.enrollment.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds }, accessClosed: false },
      _count: true,
    }),
    prisma.scormProgress.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds } },
      _avg: { score: true },
      _sum: { timeSpent: true },
    }),
    prisma.certificate.groupBy({
      by: ['courseId'],
      where: { courseId: { in: courseIds }, revokedAt: null },
      _count: true,
    }),
  ]);

  const completedMap = new Map(completedByCourse.map((x) => [x.courseId, x._count]));
  const accessOpenMap = new Map(accessOpenByCourse.map((x) => [x.courseId, x._count]));
  const avgScoreMap = new Map(progressAgg.map((x) => [x.courseId, x._avg.score]));
  const timeSumMap = new Map(progressAgg.map((x) => [x.courseId, x._sum.timeSpent ?? 0]));
  const certsMap = new Map(certsNotRevoked.map((x) => [x.courseId, x._count]));

  const rows = courses.map((c) => {
    const enrolled = c._count.enrollments;
    const completed = completedMap.get(c.id) ?? 0;
    const accessOpen = accessOpenMap.get(c.id) ?? 0;
    const certs = certsMap.get(c.id) ?? 0;
    const completionRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
    const avgScore = avgScoreMap.get(c.id);
    const timeSum = timeSumMap.get(c.id) ?? 0;

    return {
      courseId: c.id,
      title: c.title,
      status: c.status,
      enrolled,
      accessOpen,
      completed,
      completionRatePercent: completionRate,
      certificates: certs,
      avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
      timeSpentMinutes: timeSum,
    };
  });

  return NextResponse.json({
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    rows,
  });
}
