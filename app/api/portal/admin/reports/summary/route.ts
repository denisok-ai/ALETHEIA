/**
 * Admin: сводный отчёт — ключевые показатели на дату / за период.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseReportPeriod } from '@/lib/reports';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { dateFrom, dateTo } = parseReportPeriod(request.nextUrl.searchParams);

  const [
    usersActiveCount,
    coursesCount,
    coursesPublishedCount,
    enrollmentsTotal,
    enrollmentsCompletedTotal,
    enrollmentsInPeriod,
    completedInPeriod,
    certificatesTotal,
    certificatesInPeriod,
    ordersPaidInPeriod,
  ] = await Promise.all([
    prisma.profile.count({ where: { status: 'active', role: 'user' } }),
    prisma.course.count(),
    prisma.course.count({ where: { status: 'published' } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { completedAt: { not: null } } }),
    prisma.enrollment.count({ where: { enrolledAt: { gte: dateFrom, lte: dateTo } } }),
    prisma.enrollment.count({
      where: { completedAt: { gte: dateFrom, lte: dateTo } },
    }),
    prisma.certificate.count({ where: { revokedAt: null } }),
    prisma.certificate.count({
      where: { revokedAt: null, issuedAt: { gte: dateFrom, lte: dateTo } },
    }),
    prisma.order.aggregate({
      where: { status: 'paid', paidAt: { gte: dateFrom, lte: dateTo } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const revenueInPeriod = ordersPaidInPeriod._sum.amount ?? 0;
  const completionRate =
    enrollmentsTotal > 0 ? Math.round((enrollmentsCompletedTotal / enrollmentsTotal) * 100) : 0;

  return NextResponse.json({
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    summary: {
      usersActive: usersActiveCount,
      coursesTotal: coursesCount,
      coursesPublished: coursesPublishedCount,
      enrollmentsTotal,
      enrollmentsCompletedTotal,
      completionRatePercent: completionRate,
      certificatesTotal,
      enrollmentsInPeriod,
      completedInPeriod,
      certificatesInPeriod,
      ordersCountInPeriod: ordersPaidInPeriod._count,
      revenueInPeriod,
    },
  });
}
