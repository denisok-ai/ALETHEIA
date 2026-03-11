/**
 * Admin: отчёт по слушателям — зачислено, завершено, сертификаты, активность, время.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseReportPeriod } from '@/lib/reports';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { dateFrom, dateTo } = parseReportPeriod(request.nextUrl.searchParams);
  const roleFilter = request.nextUrl.searchParams.get('role')?.trim(); // user | manager | admin | all

  const profiles = await prisma.profile.findMany({
    where: {
      ...(roleFilter && roleFilter !== 'all' ? { role: roleFilter } : {}),
      status: 'active',
    },
    select: {
      userId: true,
      displayName: true,
      email: true,
      role: true,
      user: {
        select: {
          email: true,
          enrollments: { select: { id: true, completedAt: true, accessClosed: true, enrolledAt: true } },
          certificates: { where: { revokedAt: null }, select: { id: true } },
          scormProgress: { select: { timeSpent: true, lastUpdated: true } },
        },
      },
    },
  });

  const rows = profiles.map((p) => {
    const enrollments = p.user.enrollments;
    const enrolled = enrollments.length;
    const inProgress = enrollments.filter((e) => !e.completedAt && !e.accessClosed).length;
    const completed = enrollments.filter((e) => e.completedAt != null).length;
    const certs = p.user.certificates.length;
    const lastActivity = p.user.scormProgress.length
      ? new Date(
          Math.max(...p.user.scormProgress.map((s) => new Date(s.lastUpdated).getTime()))
        ).toISOString()
      : enrollments.length
        ? new Date(
            Math.max(...enrollments.map((e) => new Date(e.enrolledAt).getTime()))
          ).toISOString()
        : null;
    const timeSpent = p.user.scormProgress.reduce((sum, s) => sum + (s.timeSpent ?? 0), 0);
    const displayName = p.displayName || p.user.email || p.email || '—';
    const email = p.email || p.user.email || '';

    const enrolledInPeriod = enrollments.some(
      (e) => new Date(e.enrolledAt) >= dateFrom && new Date(e.enrolledAt) <= dateTo
    );

    return {
      userId: p.userId,
      displayName,
      email,
      role: p.role,
      enrolled,
      inProgress,
      completed,
      certificates: certs,
      lastActivity,
      timeSpentMinutes: timeSpent,
      enrolledInPeriod,
    };
  });

  // Фильтр по периоду: зачислен в период ИЛИ последняя активность в периоде
  const filtered = rows.filter((r) => {
    if (r.enrolledInPeriod) return true;
    if (!r.lastActivity) return false;
    const d = new Date(r.lastActivity);
    return d >= dateFrom && d <= dateTo;
  });

  return NextResponse.json({
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    rows: filtered.map(({ enrolledInPeriod: _, ...rest }) => rest),
  });
}
