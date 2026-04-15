/**
 * Admin: get AI tutor conversation detail with messages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ courseId: string; convId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { courseId, convId } = await params;

  const conv = await prisma.aiTutorConversation.findFirst({
    where: { id: convId, courseId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: conv.id,
    userId: conv.userId,
    userEmail: conv.user.email,
    displayName: conv.user.profile?.displayName ?? null,
    lessonId: conv.lessonId,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messages: conv.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
