/**
 * Admin: get one publication (GET), update (PATCH), delete (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { publicationUpdateSchema } from '@/lib/validations/publication';
import { writeAuditLog } from '@/lib/audit';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function fallbackTitle(content: string): string {
  const text = stripHtml(content);
  return text.slice(0, 50) + (text.length > 50 ? '…' : '');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const pub = await prisma.publication.findUnique({
    where: { id },
  });
  if (!pub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    publication: {
      id: pub.id,
      title: pub.title,
      type: pub.type,
      status: pub.status,
      publishAt: pub.publishAt.toISOString(),
      teaser: pub.teaser,
      content: pub.content,
      keywords: pub.keywords,
      viewsCount: pub.viewsCount,
      ratingSum: pub.ratingSum,
      ratingCount: pub.ratingCount,
      allowComments: pub.allowComments,
      allowRating: pub.allowRating,
      createdAt: pub.createdAt.toISOString(),
      updatedAt: pub.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.publication.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = publicationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const update: {
    title?: string;
    type?: string;
    status?: string;
    publishAt?: Date;
    teaser?: string | null;
    content?: string;
    keywords?: string | null;
    allowComments?: boolean;
    allowRating?: boolean;
  } = {};

  if (data.title !== undefined)
    update.title = (data.title && data.title.trim()) || fallbackTitle(data.content ?? existing.content);

  if (data.type !== undefined) update.type = data.type;
  if (data.status !== undefined) update.status = data.status;
  if (data.publishAt !== undefined) update.publishAt = new Date(data.publishAt);
  if (data.teaser !== undefined) update.teaser = data.teaser?.trim() || null;
  if (data.content !== undefined) update.content = data.content;
  if (data.keywords !== undefined) update.keywords = data.keywords?.trim() || null;
  if (data.allowComments !== undefined) update.allowComments = data.allowComments;
  if (data.allowRating !== undefined) update.allowRating = data.allowRating;

  const pub = await prisma.publication.update({
    where: { id },
    data: update,
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'publication.update',
    entity: 'Publication',
    entityId: id,
    diff: { title: pub.title },
  });

  return NextResponse.json({
    publication: {
      id: pub.id,
      title: pub.title,
      type: pub.type,
      status: pub.status,
      publishAt: pub.publishAt.toISOString(),
      teaser: pub.teaser,
      content: pub.content,
      keywords: pub.keywords,
      viewsCount: pub.viewsCount,
      ratingSum: pub.ratingSum,
      ratingCount: pub.ratingCount,
      allowComments: pub.allowComments,
      allowRating: pub.allowRating,
      createdAt: pub.createdAt.toISOString(),
      updatedAt: pub.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.publication.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.publication.delete({ where: { id } });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'publication.delete',
    entity: 'Publication',
    entityId: id,
    diff: { title: existing.title },
  });

  return NextResponse.json({ success: true });
}
