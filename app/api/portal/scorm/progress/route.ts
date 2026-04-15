/**
 * SCORM progress API: get/set CMI data for a user/course/lesson.
 * Accepts both our format (cmi_data, completion_status, score, time_spent) and scorm-again commit format (cmi object).
 * Auto-issues certificate when completion_status is "completed" and no cert exists.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { triggerNotification } from '@/lib/notifications';
import { awardXpForLessonCompletedIfNew } from '@/lib/gamification';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { recordGamificationXpEvent } from '@/lib/gamification-ledger';
import { notifyGamificationAfterXpChange } from '@/lib/gamification-milestones';
import { nanoid } from 'nanoid';

/** SCORM 1.2/2004: "passed" и "completed" считаем завершённым уроком. */
function isLessonCompleted(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'passed';
}

/** Extract completion_status, score, timeSpent from scorm-again CMI object (1.2 or 2004). */
function extractFromCmi(cmi: Record<string, unknown>): {
  completionStatus: string | null;
  score: number | null;
  timeSpent: number;
} {
  let completionStatus: string | null = null;
  let score: number | null = null;
  let timeSpent = 0;

  const core = cmi.core as Record<string, unknown> | undefined;
  const core12 = core as { lesson_status?: string; score?: { raw?: string }; total_time?: string } | undefined;
  if (core12?.lesson_status) completionStatus = core12.lesson_status;
  if (core12?.score?.raw != null) score = Number(core12.score.raw);
  if (core12?.total_time) timeSpent = parseScormTime(core12.total_time);

  const completion = cmi.completion_status as string | undefined;
  if (completion) completionStatus = completion;
  const success = cmi.success_status as string | undefined;
  if (success) completionStatus = success;
  const sc = cmi.score as { scaled?: string } | undefined;
  if (sc?.scaled != null) score = Number(sc.scaled) * 100;
  const total = cmi.total_time as string | undefined;
  if (total) timeSpent = parseScormTime(total);
  const session = cmi.session_time as string | undefined;
  if (session) timeSpent += parseScormTime(session);
  if (typeof cmi.totalTimeSeconds === 'number') timeSpent = Math.round(cmi.totalTimeSeconds);

  return { completionStatus, score, timeSpent };
}

function parseScormTime(s: string): number {
  if (!s || typeof s !== 'string') return 0;
  const match = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i) ?? s.match(/^(\d+):(\d+):(\d+)$/);
  if (!match) return 0;
  if (match[4] !== undefined) {
    const [, h, m, sec] = match.map(Number);
    return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
  }
  const [, h, m, sec] = match.map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (sec || 0);
}

async function maybeIssueCertificate(userId: string, courseId: string, lessonId: string) {
  const existing = await prisma.certificate.findFirst({
    where: { userId, courseId },
  });
  if (existing) return;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, scormManifest: true, verificationRequiredLessonIds: true },
  });
  if (!course) return;

  const requiredLessonIds: string[] = [];
  if (course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as { items?: { identifier: string }[] };
      const items = manifest.items ?? [];
      if (items.length > 1) {
        requiredLessonIds.push(...items.map((i) => i.identifier));
      } else if (items.length === 1) {
        requiredLessonIds.push(items[0].identifier);
      } else {
        requiredLessonIds.push('main');
      }
    } catch {
      requiredLessonIds.push(lessonId);
    }
  } else {
    requiredLessonIds.push(lessonId);
  }

  const completed = await prisma.scormProgress.findMany({
    where: {
      userId,
      courseId,
      lessonId: { in: requiredLessonIds },
      completionStatus: { in: ['completed', 'passed'] },
    },
  });
  if (completed.length < requiredLessonIds.length) return;

  const { getVerificationLessonIds } = await import('@/lib/verification-lessons');
  const verificationRequiredIds = getVerificationLessonIds(course.verificationRequiredLessonIds);
  if (verificationRequiredIds.length > 0) {
    const approvedByLesson = await prisma.phygitalVerification.findMany({
      where: {
        userId,
        courseId,
        status: 'approved',
        lessonId: { in: verificationRequiredIds },
      },
      select: { lessonId: true },
    });
    const approvedLessonIds = new Set(approvedByLesson.map((v) => v.lessonId).filter(Boolean));
    const missing = verificationRequiredIds.filter((id) => !approvedLessonIds.has(id));
    if (missing.length > 0) return;
  }

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { displayName: true } });
  const certNumber = `ALT-${nanoid(8).toUpperCase()}`;

  await prisma.certificate.create({
    data: {
      userId,
      courseId,
      certNumber,
    },
  });

  await triggerNotification({
    eventType: 'certificate_issued',
    userId,
    metadata: { objectname: course.title },
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const lessonId = searchParams.get('lessonId');
  if (!courseId || !lessonId) return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });

  if (role !== 'admin' && role !== 'manager') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.accessClosed) {
      return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
    }
  }

  const progress = await prisma.scormProgress.findUnique({
    where: {
      userId_courseId_lessonId: { userId, courseId, lessonId },
    },
  });

  if (!progress) {
    return NextResponse.json({ cmi_data: {}, completion_status: null, score: null, time_spent: 0 });
  }

  return NextResponse.json({
    cmi_data: progress.cmiData ? JSON.parse(progress.cmiData) : {},
    completion_status: progress.completionStatus,
    score: progress.score,
    time_spent: progress.timeSpent,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) {
    console.warn('[SCORM progress] POST 401: no session', { hasCookie: !!request.headers.get('cookie') });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  const rawText = await request.text();
  try {
    body = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch (e) {
    console.warn('[SCORM progress] POST 400: invalid JSON', { textPreview: rawText.slice(0, 200) }, e);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const courseId = body.courseId as string | undefined;
  const lessonId = body.lessonId as string | undefined;
  if (!courseId || !lessonId) return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });

  console.log('[SCORM progress] POST', { userId, role, courseId, lessonId, completion_status: body.completion_status });

  if (role === 'admin') {
    // Admin может тестировать любой курс без записи — пропускаем проверку enrollment
  } else if (role === 'manager') {
    const managerEnrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!managerEnrollment) {
      console.log('[SCORM progress] manager without enrollment, skipping save', { userId, courseId, lessonId });
      return NextResponse.json({ success: true });
    }
  } else {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      console.warn('[SCORM progress] POST 403: not enrolled', { userId, courseId, lessonId });
      return NextResponse.json(
        { error: 'Нет доступа к курсу. Запишитесь на курс для прохождения.' },
        { status: 403 }
      );
    }
  }

  const cmi = body.cmi as Record<string, unknown> | undefined;
  const cmi_data = body.cmi_data as Record<string, unknown> | undefined;
  const runtimeData = body.runtimeData as Record<string, unknown> | undefined;
  // scorm-again CommitObject: completionStatus, successStatus, totalTimeSeconds, score.scaled, runtimeData
  let completionStatus: string | null =
    (body.completion_status as string) ?? (body.completionStatus as string)
    ?? (body.lesson_status as string) ?? (body.success_status as string) ?? (body.successStatus as string) ?? null;
  let scoreVal: number | null = null;
  if (body.score != null) {
    if (typeof body.score === 'number') scoreVal = body.score <= 1 ? Math.round(body.score * 100) : Math.round(body.score);
    else if (typeof body.score === 'object' && body.score !== null) {
      const sc = (body.score as { scaled?: number }).scaled;
      scoreVal = sc != null ? (sc <= 1 ? Math.round(sc * 100) : Math.round(sc)) : null;
    }
  }
  let timeSpentVal = 0;
  if (typeof body.time_spent === 'number') timeSpentVal = body.time_spent;
  if (typeof body.totalTimeSeconds === 'number') timeSpentVal = Math.round(body.totalTimeSeconds);
  if (typeof body.total_time === 'string') timeSpentVal = parseScormTime(body.total_time);

  const rawCmi = cmi ?? runtimeData ?? (body.core ? body : null);
  if (rawCmi && typeof rawCmi === 'object') {
    const extracted = extractFromCmi(rawCmi as Record<string, unknown>);
    completionStatus = extracted.completionStatus ?? completionStatus;
    scoreVal = extracted.score ?? scoreVal;
    if (extracted.timeSpent > 0) timeSpentVal = extracted.timeSpent;
  }

  const cmiData: Record<string, unknown> =
    (rawCmi && typeof rawCmi === 'object' ? rawCmi : cmi_data) ?? {};

  const [previousProgress, gamificationNumbers, courseRow] = await Promise.all([
    prisma.scormProgress.findUnique({
      where: { userId_courseId_lessonId: { userId, courseId, lessonId } },
      select: { completionStatus: true },
    }),
    getGamificationNumbers(),
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
  ]);

  let awardResult: {
    awarded: boolean;
    oldXp?: number;
    newXp?: number;
    newLevel?: number;
  } = { awarded: false };

  await prisma.$transaction(async (tx) => {
    await tx.scormProgress.upsert({
      where: {
        userId_courseId_lessonId: { userId, courseId, lessonId },
      },
      create: {
        userId,
        courseId,
        lessonId,
        cmiData: JSON.stringify(cmiData),
        completionStatus,
        score: scoreVal,
        timeSpent: timeSpentVal,
      },
      update: {
        cmiData: JSON.stringify(cmiData),
        completionStatus,
        score: scoreVal,
        timeSpent: timeSpentVal,
      },
    });

    const xpAward = await awardXpForLessonCompletedIfNew(tx, {
      userId,
      role,
      previousCompletionStatus: previousProgress?.completionStatus,
      newCompletionStatus: completionStatus,
      xpDelta: gamificationNumbers.xpLessonComplete,
      xpPerLevel: gamificationNumbers.xpPerLevel,
    });

    if (xpAward.awarded && xpAward.newXp != null && xpAward.oldXp !== undefined) {
      await recordGamificationXpEvent(tx, {
        userId,
        source: 'lesson_complete',
        delta: gamificationNumbers.xpLessonComplete,
        balanceAfter: xpAward.newXp,
        meta: {
          courseId,
          lessonId,
          courseTitle: courseRow?.title ?? null,
        },
      });
    }

    awardResult = xpAward;
  });

  console.log('[SCORM progress] saved', { userId, courseId, lessonId, completionStatus, score: scoreVal, timeSpent: timeSpentVal });

  if (
    awardResult.awarded &&
    awardResult.oldXp !== undefined &&
    awardResult.newXp !== undefined
  ) {
    try {
      await notifyGamificationAfterXpChange({
        userId,
        oldXp: awardResult.oldXp,
        newXp: awardResult.newXp,
        xpPerLevel: gamificationNumbers.xpPerLevel,
      });
    } catch (e) {
      console.error('[SCORM progress] gamification notify error:', e);
    }
  }

  if (isLessonCompleted(completionStatus)) {
    try {
      await maybeIssueCertificate(userId, courseId, lessonId);
    } catch (e) {
      console.error('Auto-certificate error:', e);
    }
  }

  return NextResponse.json({ success: true });
}
