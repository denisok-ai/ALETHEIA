/**
 * Student: create verification (POST). List my submissions (GET).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

function isValidUrl(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length > 2000) return false;
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/uploads/');
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { courseId?: string; lessonId?: string; videoUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
  const lessonId = typeof body.lessonId === 'string' ? body.lessonId.trim() || null : null;
  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';

  if (!courseId || !videoUrl) {
    return NextResponse.json(
      { error: 'Укажите курс и ссылку на видео' },
      { status: 400 }
    );
  }
  if (!isValidUrl(videoUrl)) {
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
    },
    orderBy: { createdAt: 'desc' },
  });

  const items = list.map((v) => ({
    id: v.id,
    courseId: v.courseId,
    courseTitle: v.course?.title ?? 'Курс',
    lessonId: v.lessonId,
    videoUrl: v.videoUrl,
    status: v.status,
    comment: v.comment,
    reviewedAt: v.reviewedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
