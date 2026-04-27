/**
 * Admin: list AI tutor conversations for a course.
 * GET ?page=0&pageSize=20
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId } = await params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

  const [conversations, total] = await Promise.all([
    prisma.aiTutorConversation.findMany({
      where: { courseId },
      orderBy: { updatedAt: 'desc' },
      skip: page * pageSize,
      take: pageSize,
      select: {
        id: true,
        userId: true,
        lessonId: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
        user: {
          select: {
            email: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.aiTutorConversation.count({ where: { courseId } }),
  ]);

  const list = conversations.map((c) => ({
    id: c.id,
    userId: c.userId,
    userEmail: c.user.email,
    displayName: c.user.profile?.displayName ?? null,
    lessonId: c.lessonId,
    messageCount: c._count.messages,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return NextResponse.json({
    conversations: list,
    total,
    page,
    pageSize,
  });
}
