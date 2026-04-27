/**
 * Student: create verification (POST). List my submissions (GET).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isValidTextSubmission, isValidVideoSubmissionUrl } from '@/lib/verification-submission';
import { serializeThreadComment } from '@/lib/verification-thread-comments';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { courseId?: string; lessonId?: string; videoUrl?: string; assignmentType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
  const lessonId = typeof body.lessonId === 'string' ? body.lessonId.trim() || null : null;
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
  const assignmentType =
    body.assignmentType === 'text' ? 'text' : 'video';

  if (!courseId || !videoUrl) {
    return NextResponse.json(
      {
        error:
          assignmentType === 'text'
            ? 'Укажите курс и текст ответа'
            : 'Укажите курс и ссылку на видео',
      },
      { status: 400 }
    );
  }
  if (assignmentType === 'text') {
    if (!isValidTextSubmission(videoUrl)) {
      return NextResponse.json(
        { error: 'Текст ответа: от 1 до 20 000 символов' },
        { status: 400 }
      );
    }
  } else if (!isValidVideoSubmissionUrl(videoUrl)) {
    return NextResponse.json(
      { error: 'Укажите ссылку на видео (http/https) или загрузите файл' },
      { status: 400 }
    );
  }

  if (role !== 'admin') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: 'Нет доступа к этому курсу' }, { status: 403 });
    }
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });
  if (!course) {
    return NextResponse.json({ error: 'Курс не найден' }, { status: 404 });
  }

  const verification = await prisma.phygitalVerification.create({
    data: {
      userId,
      courseId,
      lessonId,
      assignmentType,
      videoUrl,
      status: 'pending',
    },
  });

  return NextResponse.json({
    id: verification.id,
    courseId: verification.courseId,
    lessonId: verification.lessonId,
    status: verification.status,
    createdAt: verification.createdAt.toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const list = await prisma.phygitalVerification.findMany({
    where: { userId },
    include: {
      course: { select: { id: true, title: true } },
      threadComments: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const items = list.map((v) => ({
    id: v.id,
    courseId: v.courseId,
    courseTitle: v.course?.title ?? 'Курс',
    lessonId: v.lessonId,
    assignmentType: v.assignmentType ?? 'video',
    videoUrl: v.videoUrl,
    status: v.status,
    comment: v.comment,
    reviewedAt: v.reviewedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    threadComments: v.threadComments.map((c) => serializeThreadComment(c, v.userId)),
  }));

  return NextResponse.json({ items });
}
