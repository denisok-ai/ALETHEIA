/**
 * Admin: detailed progress for one user in one course (per-lesson).
 * GET /api/portal/admin/courses/[courseId]/enrollments/[userId]
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; userId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId, userId } = await params;
  if (!courseId || !userId) {
    return NextResponse.json({ error: 'Missing courseId or userId' }, { status: 400 });
  }

  const [enrollment, course, user, progressList, certificate] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, scormManifest: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, profile: { select: { displayName: true } } },
    }),
    prisma.scormProgress.findMany({
      where: { userId, courseId },
      orderBy: { lessonId: 'asc' },
    }),
    prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
      select: { certNumber: true, issuedAt: true },
    }),
  ]);

  if (!enrollment || !course || !user) {
    return NextResponse.json({ error: 'Enrollment or user not found' }, { status: 404 });
  }

  let requiredLessonIds: { identifier: string; title?: string }[] = [{ identifier: 'main' }];
  if (course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as {
        items?: { identifier: string; title?: string }[];
      };
      const items = manifest.items ?? [];
      if (items.length > 0) requiredLessonIds = items.map((i) => ({ identifier: i.identifier, title: i.title }));
    } catch {
      // keep main
    }
  }

  const progressByLesson: Record<string, { completionStatus: string | null; score: number | null; timeSpent: number }> = {};
  for (const p of progressList) {
    progressByLesson[p.lessonId] = {
      completionStatus: p.completionStatus,
      score: p.score,
      timeSpent: p.timeSpent,
    };
  }

  const lessons = requiredLessonIds.map((lesson) => {
    const prog = progressByLesson[lesson.identifier];
    return {
      lessonId: lesson.identifier,
      title: lesson.title ?? lesson.identifier,
      completionStatus: prog?.completionStatus ?? null,
      score: prog?.score ?? null,
      timeSpent: prog?.timeSpent ?? 0,
    };
  });

  const completedCount = lessons.filter(
    (l) => l.completionStatus === 'completed' || l.completionStatus === 'passed'
  ).length;
  const totalLessons = lessons.length;
  const avgScore =
    lessons.filter((l) => l.score != null).length > 0
      ? lessons.reduce((acc, l) => acc + (l.score ?? 0), 0) / lessons.filter((l) => l.score != null).length
      : null;
  const totalTimeSeconds = lessons.reduce((acc, l) => acc + l.timeSpent, 0);

  return NextResponse.json({
    enrollment: {
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    },
    user: {
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
    },
    course: { id: course.id, title: course.title },
    summary: {
      completedLessons: completedCount,
      totalLessons,
      percent: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
      avgScore: avgScore != null ? Math.round(avgScore) : null,
      totalTimeSeconds,
    },
    lessons,
    certificate: certificate
      ? { certNumber: certificate.certNumber, issuedAt: certificate.issuedAt.toISOString() }
      : null,
  });
}
