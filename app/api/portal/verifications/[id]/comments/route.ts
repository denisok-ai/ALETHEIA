/**
 * Комментарии к заданию на верификацию: чтение и добавление (слушатель или менеджер/админ).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  serializeThreadComment,
  VERIFICATION_THREAD_COMMENT_MAX_LEN,
} from '@/lib/verification-thread-comments';

async function loadVerificationForAccess(id: string) {
  return prisma.phygitalVerification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
}

function canAccessAsReviewer(role: string | undefined) {
  return role === 'manager' || role === 'admin';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const v = await loadVerificationForAccess(id);
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (v.userId !== userId && !canAccessAsReviewer(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await prisma.phygitalVerificationThreadComment.findMany({
    where: { verificationId: id },
    orderBy: { createdAt: 'asc' },
  });

  const comments = rows.map((r) => serializeThreadComment(r, v.userId));
  return NextResponse.json({ comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const v = await loadVerificationForAccess(id);
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isOwner = v.userId === userId;
  const isReviewer = canAccessAsReviewer(role);
  if (!isOwner && !isReviewer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'Введите текст комментария' }, { status: 400 });
  }
  if (text.length > VERIFICATION_THREAD_COMMENT_MAX_LEN) {
    return NextResponse.json(
      { error: `Комментарий не длиннее ${VERIFICATION_THREAD_COMMENT_MAX_LEN} символов` },
      { status: 400 }
    );
  }

  const created = await prisma.phygitalVerificationThreadComment.create({
    data: {
      verificationId: id,
      authorUserId: userId,
      body: text,
    },
  });

  return NextResponse.json({
    comment: serializeThreadComment(created, v.userId),
  });
}
