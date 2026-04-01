/**
 * Student: get one verification (GET), update own pending verification (PATCH).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isValidTextSubmission, isValidVideoSubmissionUrl } from '@/lib/verification-submission';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const verification = await prisma.phygitalVerification.findUnique({
    where: { id },
  });
  if (!verification) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (verification.userId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (verification.status !== 'pending') {
    return NextResponse.json(
      { error: 'Редактировать можно только задание со статусом «На проверке»' },
      { status: 400 }
    );
  }

  let body: { videoUrl?: string; lessonId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: { videoUrl?: string; lessonId?: string | null } = {};
  if (body.videoUrl !== undefined) {
    const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
    const isText = verification.assignmentType === 'text';
    if (isText) {
      if (!isValidTextSubmission(videoUrl)) {
        return NextResponse.json(
          { error: 'Текст ответа: от 1 до 20 000 символов' },
          { status: 400 }
        );
      }
      updates.videoUrl = videoUrl;
    } else {
      if (!videoUrl || !isValidVideoSubmissionUrl(videoUrl)) {
        return NextResponse.json(
          { error: 'Укажите ссылку на видео (http/https) или загрузите файл' },
          { status: 400 }
        );
      }
      updates.videoUrl = videoUrl;
    }
  }
  if (body.lessonId !== undefined) {
    updates.lessonId = typeof body.lessonId === 'string' && body.lessonId.trim() ? body.lessonId.trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(verification);
  }

  const updated = await prisma.phygitalVerification.update({
    where: { id },
    data: updates,
  });

  return NextResponse.json({
    id: updated.id,
    courseId: updated.courseId,
    lessonId: updated.lessonId,
    videoUrl: updated.videoUrl,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  });
}
