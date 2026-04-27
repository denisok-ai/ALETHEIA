/**
 * Admin: ручная выдача сертификата (пользователь + курс).
 * Использует шаблон курса при наличии (templateId, validityDays, numberingFormat).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { triggerNotification } from '@/lib/notifications';
import { getTemplateForCourse } from '@/lib/certificates/eligibility';
import { nanoid } from 'nanoid';
import { addDays } from 'date-fns';

function buildCertNumber(template: { numberingFormat?: string | null } | null, fallback: string): string {
  const format = template?.numberingFormat?.trim();
  if (format) {
    return format.replace(/%ID%/gi, nanoid(8).toUpperCase());
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { userId?: string; courseId?: string; validityDays?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
  const validityDaysOverride = typeof body.validityDays === 'number' && body.validityDays > 0 ? body.validityDays : undefined;

  if (!userId || !courseId) {
    return NextResponse.json({ error: 'userId и courseId обязательны' }, { status: 400 });
  }

  const [user, course, template] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
    getTemplateForCourse(courseId),
  ]);

  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  if (!course) return NextResponse.json({ error: 'Курс не найден' }, { status: 404 });

  const existing = await prisma.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Сертификат по этому курсу уже выдан данному пользователю' }, { status: 400 });
  }

  const validityDays = validityDaysOverride ?? template?.validityDays ?? undefined;
  const now = new Date();
  const expiryDate = validityDays != null ? addDays(now, validityDays) : null;
  const certNumber = buildCertNumber(template, `ALT-${nanoid(8).toUpperCase()}`);

  const cert = await prisma.certificate.create({
    data: {
      userId,
      courseId,
      templateId: template?.id ?? null,
      certNumber,
      expiryDate,
    },
  });

  await triggerNotification({
    eventType: 'certificate_issued',
    userId,
    metadata: { objectname: course.title },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'certificate.issue',
    entity: 'Certificate',
    entityId: cert.id,
    diff: { userId, courseId, certNumber, validityDays: validityDays ?? null },
  });

  return NextResponse.json({
    id: cert.id,
    certNumber: cert.certNumber,
    userId: cert.userId,
    courseId: cert.courseId,
    issuedAt: cert.issuedAt.toISOString(),
    expiryDate: cert.expiryDate?.toISOString() ?? null,
  });
}
