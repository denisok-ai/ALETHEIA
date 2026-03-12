/**
 * Admin: mass-issue certificates for users who completed the course but don't have a cert.
 * Учитывает шаблон курса: minScore, requiredStatus; при выдаче — templateId, expiryDate, numberingFormat.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { triggerNotification } from '@/lib/notifications';
import {
  registerTask,
  updateTaskProgress,
  isInterrupted,
  removeTask,
} from '@/lib/background-tasks';
import { checkCertificateEligibility } from '@/lib/certificates/eligibility';
import { nanoid } from 'nanoid';
import { addDays } from 'date-fns';

function buildCertNumber(template: { numberingFormat?: string | null } | null, fallback: string): string {
  const format = template?.numberingFormat?.trim();
  if (format) return format.replace(/%ID%/gi, nanoid(8).toUpperCase());
  return fallback;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { courseId?: string; userIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const courseId = body.courseId?.trim();
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 });
  const filterUserIds = Array.isArray(body.userIds) ? body.userIds.filter((id) => typeof id === 'string') : undefined;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true, scormManifest: true },
  });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let requiredLessonIds: string[] = ['main'];
  if (course.scormManifest) {
    try {
      const manifest = JSON.parse(course.scormManifest) as { items?: { identifier: string }[] };
      const items = manifest.items ?? [];
      if (items.length > 1) {
        requiredLessonIds = items.map((i) => i.identifier);
      } else if (items.length === 1) {
        requiredLessonIds = [items[0].identifier];
      }
    } catch {
      // keep main
    }
  }

  const completedByUser = await prisma.scormProgress.groupBy({
    by: ['userId'],
    where: {
      courseId,
      lessonId: { in: requiredLessonIds },
      completionStatus: { in: ['completed', 'passed'] },
      ...(filterUserIds?.length ? { userId: { in: filterUserIds } } : {}),
    },
    _count: { lessonId: true },
  });

  const userIdsCompleted = completedByUser
    .filter((g) => g._count.lessonId >= requiredLessonIds.length)
    .map((g) => g.userId);

  const existingCerts = await prisma.certificate.findMany({
    where: { courseId, userId: { in: userIdsCompleted } },
    select: { userId: true },
  });
  const existingUserIds = new Set(existingCerts.map((c) => c.userId));
  const toIssue = userIdsCompleted.filter((id) => !existingUserIds.has(id));

  const taskId = nanoid();
  const total = toIssue.length;
  if (total > 0) {
    registerTask(taskId, {
      name: `Массовая выдача сертификатов: ${course.title}`,
      initiatorId: auth.userId,
    });
  }

  const created: string[] = [];
  for (let i = 0; i < toIssue.length; i++) {
    if (total > 0 && isInterrupted(taskId)) {
      removeTask(taskId);
      return NextResponse.json({
        created: created.length,
        certificateIds: created,
        interrupted: true,
      });
    }
    const userId = toIssue[i];
    const eligibility = await checkCertificateEligibility(userId, courseId, 100, 'completed');
    if (!eligibility.eligible) continue;

    const validityDays = eligibility.template?.validityDays ?? undefined;
    const now = new Date();
    const expiryDate = validityDays != null ? addDays(now, validityDays) : null;
    const certNumber = buildCertNumber(eligibility.template ?? null, `ALT-${nanoid(8).toUpperCase()}`);

    const cert = await prisma.certificate.create({
      data: {
        userId,
        courseId,
        templateId: eligibility.templateId,
        certNumber,
        expiryDate,
      },
    });
    created.push(cert.id);
    await triggerNotification({
      eventType: 'certificate_issued',
      userId,
      metadata: { objectname: course.title },
    });
    if (total > 0) updateTaskProgress(taskId, Math.round(((i + 1) / total) * 100));
  }

  if (total > 0) removeTask(taskId);

  if (created.length > 0) {
    await writeAuditLog({
      actorId: auth.userId,
      action: 'certificate.bulk_generate',
      entity: 'Certificate',
      diff: { courseId, count: created.length, certificateIds: created },
    });
  }

  return NextResponse.json({ created: created.length, certificateIds: created });
}
