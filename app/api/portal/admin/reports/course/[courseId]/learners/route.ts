/**
 * Admin: отчёт «Слушатели курса» — список слушателей выбранного курса с прогрессом, баллом, временем.
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
    select: {
      id: true,
      title: true,
      scormManifest: true,
      _count: { select: { scormProgress: true } },
    },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let totalLessons = 0;
  if (course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as { items?: { identifier: string }[] };
      const items = manifest.items ?? [];
      totalLessons = items.length > 0 ? items.length : 1;
    } catch {
      totalLessons = 1;
    }
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      course: { select: { id: true } },
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const userIds = enrollments.map((e) => e.userId);
  const progressByUser = await prisma.scormProgress.groupBy({
    by: ['userId'],
    where: { courseId, userId: { in: userIds } },
    _count: true,
    _avg: { score: true },
    _sum: { timeSpent: true },
  });
  const completedByUser = await prisma.scormProgress.groupBy({
    by: ['userId'],
    where: { courseId, userId: { in: userIds }, completionStatus: { in: ['completed', 'passed'] } },
    _count: true,
  });

  const progressMap = new Map(progressByUser.map((p) => [p.userId, p]));
  const completedMap = new Map(completedByUser.map((c) => [c.userId, c._count]));

  const totalLessonsForProgress = totalLessons > 0 ? totalLessons : 1;
  const rows = enrollments.map((e) => {
    const prog = progressMap.get(e.userId);
    const completedCount = completedMap.get(e.userId) ?? 0;
    const progressPercent =
      totalLessonsForProgress > 0 ? Math.round((completedCount / totalLessonsForProgress) * 100) : 0;
    const displayName =
      e.user.profile?.displayName || e.user.email || '—';
    return {
      userId: e.userId,
      displayName,
      email: e.user.email,
      enrolledAt: e.enrolledAt.toISOString(),
      accessClosed: e.accessClosed,
      completedAt: e.completedAt?.toISOString() ?? null,
      progressPercent,
      avgScore: prog?._avg.score != null ? Math.round(prog._avg.score * 10) / 10 : null,
      timeSpentMinutes: prog?._sum.timeSpent ?? 0,
      hasCertificate: false, // заполним отдельным запросом при необходимости
    };
  });

  const certs = await prisma.certificate.findMany({
    where: { courseId, userId: { in: userIds }, revokedAt: null },
    select: { userId: true },
  });
  const certUserIds = new Set(certs.map((c) => c.userId));
  rows.forEach((r) => {
    (r as { hasCertificate: boolean }).hasCertificate = certUserIds.has(r.userId);
  });

  return NextResponse.json({
    courseId: course.id,
    courseTitle: course.title,
    totalLessons: totalLessonsForProgress,
    rows,
  });
}
