/**
 * GET ?courseId= → all ScormProgress for current user and course (for multi-SCO progress bar/sidebar).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

  if (role === 'admin') {
    return NextResponse.json({ progress: [] });
  }
  if (role === 'manager') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return NextResponse.json({ progress: [] });
  }
  if (role === 'user') {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment || enrollment.accessClosed) {
      return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });
    }
  }

  const list = await prisma.scormProgress.findMany({
    where: { userId, courseId },
    select: { lessonId: true, completionStatus: true, score: true, timeSpent: true },
  });

  return NextResponse.json({
    progress: list.map((p) => ({
      lesson_id: p.lessonId,
      completion_status: p.completionStatus,
      score: p.score,
      time_spent: p.timeSpent,
    })),
  });
}
