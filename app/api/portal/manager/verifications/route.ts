/**
 * Manager: list verifications (GET) with filters/pagination; approve/reject (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireManagerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { applyXpDeltaToUser } from '@/lib/gamification';
import { getGamificationNumbers } from '@/lib/gamification-config';
import { recordGamificationXpEvent } from '@/lib/gamification-ledger';
import { notifyGamificationAfterXpChange } from '@/lib/gamification-milestones';
import { writeAuditLog } from '@/lib/audit';

const MAX_EXPORT = 5000;
const Q_MAX_LEN = 120;

function previewSubmission(videoUrl: string, assignmentType: string, maxLen = 80): string {
  if (assignmentType === 'text') {
    const t = videoUrl.replace(/\s+/g, ' ').trim();
    return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
  }
  return videoUrl.length <= maxLen ? videoUrl : `${videoUrl.slice(0, maxLen)}…`;
}

/** GET: ?page=0&pageSize=25&sortKey=createdAt|status|course|student|reviewedAt&sortDir=asc|desc&status=all|pending|approved|rejected&assignmentType=all|video|text&userId=&courseId=&q=&dateFrom=&dateTo=&export=1 */
export async function GET(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const exportMode = searchParams.get('export') === '1';
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const pageSize = exportMode
    ? MAX_EXPORT
    : Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
  const sortKey = searchParams.get('sortKey') ?? 'createdAt';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  const statusFilter = searchParams.get('status') ?? 'all';
  const assignmentType = searchParams.get('assignmentType') ?? 'all';
  const userIdFilter = searchParams.get('userId')?.trim();
  const courseIdFilter = searchParams.get('courseId')?.trim();
  const qRaw = searchParams.get('q')?.trim() ?? '';
  const q = qRaw.slice(0, Q_MAX_LEN);
  const dateFrom = searchParams.get('dateFrom')?.trim();
  const dateTo = searchParams.get('dateTo')?.trim();

  const where: Prisma.PhygitalVerificationWhereInput = {};

  if (statusFilter === 'pending' || statusFilter === 'approved' || statusFilter === 'rejected') {
    where.status = statusFilter;
  }

  if (assignmentType === 'video' || assignmentType === 'text') {
    where.assignmentType = assignmentType;
  }

  if (userIdFilter) {
    where.userId = userIdFilter;
  }

  if (courseIdFilter) {
    where.courseId = courseIdFilter;
  }

  if (q) {
    where.user = {
      OR: [{ email: { contains: q } }, { profile: { displayName: { contains: q } } }],
    };
  }

  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      const d = new Date(dateFrom);
      if (!Number.isNaN(d.getTime())) createdAt.gte = d;
    }
    if (dateTo) {
      const d = new Date(dateTo);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        createdAt.lte = d;
      }
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  type OrderBy =
    | { createdAt: 'asc' | 'desc' }
    | { status: 'asc' | 'desc' }
    | { reviewedAt: 'asc' | 'desc' }
    | { course: { title: 'asc' | 'desc' } }
    | { user: { email: 'asc' | 'desc' } };

  let orderBy: OrderBy = { createdAt: sortDir };
  if (sortKey === 'status') orderBy = { status: sortDir };
  else if (sortKey === 'reviewedAt') orderBy = { reviewedAt: sortDir };
  else if (sortKey === 'course') orderBy = { course: { title: sortDir } };
  else if (sortKey === 'student') orderBy = { user: { email: sortDir } };
  else orderBy = { createdAt: sortDir };

  const [rows, total] = await Promise.all([
    prisma.phygitalVerification.findMany({
      where,
      skip: exportMode ? 0 : page * pageSize,
      take: pageSize,
      orderBy,
      include: {
        course: { select: { id: true, title: true } },
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true, email: true } },
          },
        },
      },
    }),
    prisma.phygitalVerification.count({ where }),
  ]);

  const reviewerIds = Array.from(
    new Set(rows.map((r) => r.reviewedBy).filter((id): id is string => !!id))
  );
  const reviewers =
    reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: {
            id: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        })
      : [];
  const reviewerMap = new Map(
    reviewers.map((u) => [
      u.id,
      u.profile?.displayName?.trim() || u.email?.split('@')[0] || u.id.slice(0, 8),
    ])
  );

  const items = rows.map((r) => {
    const p = r.user.profile;
    const studentLabel =
      p?.displayName?.trim() || p?.email?.trim() || r.user.email?.split('@')[0] || r.userId.slice(0, 8);
    return {
      id: r.id,
      userId: r.userId,
      studentEmail: r.user.email,
      studentLabel,
      courseId: r.courseId,
      courseTitle: r.course?.title ?? '',
      lessonId: r.lessonId,
      assignmentType: r.assignmentType ?? 'video',
      videoUrl: r.videoUrl,
      submissionPreview: previewSubmission(r.videoUrl, r.assignmentType ?? 'video'),
      status: r.status,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewedBy: r.reviewedBy,
      reviewerLabel: r.reviewedBy ? (reviewerMap.get(r.reviewedBy) ?? r.reviewedBy.slice(0, 8)) : null,
    };
  });

  return NextResponse.json({ items, total });
}

export async function POST(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { id: string; status: 'approved' | 'rejected'; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) || null : null;

  const existing = await prisma.phygitalVerification.findUnique({
    where: { id },
    include: { course: { select: { title: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Заявка уже обработана' }, { status: 400 });
  }

  const numbers = await getGamificationNumbers();
  const xpDelta = numbers.xpVerificationApproved;

  type GamificationNotifyPayload = { userId: string; oldXp: number; newXp: number };

  const { xpAwarded, notifyAfter } = await prisma.$transaction(
    async (tx): Promise<{ xpAwarded: number; notifyAfter: GamificationNotifyPayload | null }> => {
      await tx.phygitalVerification.update({
        where: { id },
        data: {
          status: body.status === 'approved' ? 'approved' : 'rejected',
          reviewedBy: auth.userId ?? null,
          reviewedAt: new Date(),
          ...(body.status === 'rejected' ? { comment } : {}),
        },
      });

      if (body.status !== 'approved' || xpDelta <= 0) {
        return { xpAwarded: 0, notifyAfter: null };
      }

      const result = await applyXpDeltaToUser(tx, {
        userId: existing.userId,
        xpDelta,
        xpPerLevel: numbers.xpPerLevel,
      });
      if (!result.applied) {
        return { xpAwarded: 0, notifyAfter: null };
      }

      await recordGamificationXpEvent(tx, {
        userId: existing.userId,
        source: 'verification_approved',
        delta: xpDelta,
        balanceAfter: result.newXp,
        meta: {
          verificationId: id,
          courseId: existing.courseId,
          lessonId: existing.lessonId,
          courseTitle: existing.course?.title ?? null,
        },
      });

      return {
        xpAwarded: xpDelta,
        notifyAfter: {
          userId: existing.userId,
          oldXp: result.oldXp,
          newXp: result.newXp,
        },
      };
    }
  );

  if (notifyAfter) {
    try {
      await notifyGamificationAfterXpChange({
        userId: notifyAfter.userId,
        oldXp: notifyAfter.oldXp,
        newXp: notifyAfter.newXp,
        xpPerLevel: numbers.xpPerLevel,
      });
    } catch (e) {
      console.error('[verifications] gamification notify error:', e);
    }
  }

  const finalStatus = body.status === 'approved' ? 'approved' : 'rejected';
  await writeAuditLog({
    actorId: auth.userId ?? null,
    action: finalStatus === 'approved' ? 'verification_approved' : 'verification_rejected',
    entity: 'PhygitalVerification',
    entityId: id,
    diff: {
      status: finalStatus,
      studentUserId: existing.userId,
      courseId: existing.courseId,
      lessonId: existing.lessonId,
      xpAwarded: finalStatus === 'approved' ? xpAwarded : 0,
      rejectCommentPresent: finalStatus === 'rejected' && !!comment,
    },
  });

  return NextResponse.json({
    success: true,
    xpAwarded: body.status === 'approved' ? xpAwarded : 0,
  });
}
