/**
 * Admin: list enrollments for a course with progress summary.
 * GET /api/portal/admin/courses/[courseId]/enrollments
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

function getRequiredLessonIds(scormManifest: string | null): string[] {
  if (!scormManifest) return ['main'];
  try {
    const manifest = JSON.parse(scormManifest) as { items?: { identifier: string }[] };
    const items = manifest.items ?? [];
    if (items.length > 1) return items.map((i) => i.identifier);
    if (items.length === 1) return [items[0].identifier];
  } catch {
    // ignore
  }
  return ['main'];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, scormManifest: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  const requiredLessonIds = getRequiredLessonIds(course.scormManifest);
  const totalLessons = requiredLessonIds.length;

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
    },
    orderBy: { enrolledAt: 'desc' },
  });

  const userIds = enrollments.map((e) => e.userId);
  const [progressList, certificates] = await Promise.all([
    prisma.scormProgress.findMany({
      where: { userId: { in: userIds }, courseId },
      select: {
        userId: true,
        lessonId: true,
        completionStatus: true,
        score: true,
        timeSpent: true,
        lastUpdated: true,
      },
    }),
    prisma.certificate.findMany({
      where: { userId: { in: userIds }, courseId },
      select: { userId: true, certNumber: true, issuedAt: true },
    }),
  ]);

  const progressByUser: Record<
    string,
    { completed: number; avgScore: number | null; totalTime: number; lastActivityAt: Date | null; firstActivityAt: Date | null; byLesson: { lessonId: string; status: string | null; score: number | null; timeSpent: number }[] }
  > = {};
  for (const p of progressList) {
    if (!progressByUser[p.userId]) {
      progressByUser[p.userId] = {
        completed: 0,
        avgScore: null,
        totalTime: 0,
        lastActivityAt: null,
        firstActivityAt: null,
        byLesson: [],
      };
    }
    const rec = progressByUser[p.userId];
    rec.byLesson.push({
      lessonId: p.lessonId,
      status: p.completionStatus,
      score: p.score,
      timeSpent: p.timeSpent,
    });
    if (p.completionStatus === 'completed') rec.completed += 1;
    rec.totalTime += p.timeSpent;
    if (p.lastUpdated) {
      if (!rec.lastActivityAt || p.lastUpdated > rec.lastActivityAt) rec.lastActivityAt = p.lastUpdated;
      if (!rec.firstActivityAt || p.lastUpdated < rec.firstActivityAt) rec.firstActivityAt = p.lastUpdated;
    }
  }

  const scoresByUser: Record<string, number[]> = {};
  for (const p of progressList) {
    if (p.score != null) {
      if (!scoresByUser[p.userId]) scoresByUser[p.userId] = [];
      scoresByUser[p.userId].push(p.score);
    }
  }
  for (const uid of Object.keys(progressByUser)) {
    const scores = scoresByUser[uid];
    progressByUser[uid].avgScore =
      scores && scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  const certByUser: Record<string, { certNumber: string; issuedAt: string }> = {};
  for (const c of certificates) {
    certByUser[c.userId] = { certNumber: c.certNumber, issuedAt: c.issuedAt.toISOString() };
  }

  const list = enrollments.map((e) => {
    const prog = progressByUser[e.userId] ?? {
      completed: 0,
      avgScore: null,
      totalTime: 0,
      lastActivityAt: null,
      firstActivityAt: null,
      byLesson: [],
    };
    const cert = certByUser[e.userId];
    const percent = totalLessons > 0 ? Math.round((prog.completed / totalLessons) * 100) : 0;
    const statusFromProgress = percent >= 100 ? 'completed' : prog.byLesson.length > 0 ? 'in_progress' : 'not_started';
    const status = e.completedAt ? 'completed' : statusFromProgress;
    return {
      id: e.id,
      userId: e.userId,
      courseId: e.courseId,
      enrolledAt: e.enrolledAt.toISOString(),
      expiresAt: e.expiresAt?.toISOString() ?? null,
      accessClosed: e.accessClosed ?? false,
      completedAt: e.completedAt?.toISOString() ?? null,
      lastActivityAt: prog.lastActivityAt?.toISOString() ?? null,
      firstActivityAt: prog.firstActivityAt?.toISOString() ?? null,
      attempts: prog.byLesson.length > 0 ? prog.byLesson.length : 0,
      status,
      user: {
        id: e.user.id,
        email: e.user.email,
        displayName: e.user.profile?.displayName ?? null,
      },
      progress: {
        completedLessons: prog.completed,
        totalLessons,
        percent,
        avgScore: prog.avgScore != null ? Math.round(prog.avgScore) : null,
        totalTimeSeconds: prog.totalTime,
      },
      certificate: cert
        ? { certNumber: cert.certNumber, issuedAt: cert.issuedAt }
        : null,
    };
  });

  return NextResponse.json({ enrollments: list, courseTitle: course.title });
}

/**
 * PATCH: bulk set access for all enrollments (Открыть всем / Закрыть всем).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  let body: { accessClosed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (body.accessClosed === undefined) return NextResponse.json({ error: 'accessClosed required' }, { status: 400 });

  const result = await prisma.enrollment.updateMany({
    where: { courseId },
    data: { accessClosed: body.accessClosed },
  });

  return NextResponse.json({ updated: result.count });
}
