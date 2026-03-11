/**
 * Public: list comments (GET), add comment (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { publicationCommentSchema } from '@/lib/validations/publication';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const pub = await prisma.publication.findFirst({
    where: { id, status: 'active', allowComments: true },
  });
  if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const comments = await prisma.publicationComment.findMany({
    where: { publicationId: id },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { displayName: true }, include: { profile: { select: { displayName: true } } } } },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      authorName: c.authorName ?? c.user?.profile?.displayName ?? c.user?.displayName ?? 'Гость',
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  const pub = await prisma.publication.findFirst({
    where: { id, status: 'active', allowComments: true },
  });
  if (!pub) return NextResponse.json({ error: 'Not found or comments disabled' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = publicationCommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  const userId = (session?.user as { id?: string })?.id ?? null;
  const authorName = parsed.data.authorName?.trim() || null;

  const comment = await prisma.publicationComment.create({
    data: {
      publicationId: id,
      userId,
      authorName: authorName || (userId ? null : 'Гость'),
      content: parsed.data.content,
    },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      content: comment.content,
      authorName: comment.authorName ?? undefined,
      createdAt: comment.createdAt.toISOString(),
    },
  });
}
