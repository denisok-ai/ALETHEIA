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
import { nanoid } from 'nanoid';

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
  const sc = cmi.score as { scaled?: string } | undefined;
  if (sc?.scaled != null) score = Number(sc.scaled) * 100;
  const total = cmi.total_time as string | undefined;
  if (total) timeSpent = parseScormTime(total);
  const session = cmi.session_time as string | undefined;
  if (session) timeSpent += parseScormTime(session);

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
    select: { title: true, scormManifest: true },
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
      completionStatus: 'completed',
    },
  });
  if (completed.length < requiredLessonIds.length) return;

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
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const lessonId = searchParams.get('lessonId');
  if (!courseId || !lessonId) return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });

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
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    courseId?: string;
    lessonId?: string;
    cmi?: Record<string, unknown>;
    cmi_data?: Record<string, unknown>;
    completion_status?: string;
    score?: number;
    time_spent?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { courseId, lessonId, cmi, cmi_data, completion_status, score, time_spent } = body;
  if (!courseId || !lessonId) return NextResponse.json({ error: 'Missing courseId or lessonId' }, { status: 400 });

  if (role === 'admin') {
    return NextResponse.json({ success: true });
  }

  let cmiData: Record<string, unknown>;
  let completionStatus: string | null = completion_status ?? null;
  let scoreVal: number | null = score ?? null;
  let timeSpentVal = time_spent ?? 0;

  if (cmi && typeof cmi === 'object') {
    const extracted = extractFromCmi(cmi);
    completionStatus = extracted.completionStatus ?? completionStatus;
    scoreVal = extracted.score ?? scoreVal;
    timeSpentVal = extracted.timeSpent || timeSpentVal;
    cmiData = cmi as Record<string, unknown>;
  } else {
    cmiData = cmi_data ?? {};
  }

  await prisma.scormProgress.upsert({
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

  if (completionStatus === 'completed') {
    try {
      await maybeIssueCertificate(userId, courseId, lessonId);
    } catch (e) {
      console.error('Auto-certificate error:', e);
    }
  }

  return NextResponse.json({ success: true });
}
