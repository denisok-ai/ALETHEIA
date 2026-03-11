/**
 * Admin: list publications (GET), create publication (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { publicationCreateSchema } from '@/lib/validations/publication';
import { writeAuditLog } from '@/lib/audit';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function fallbackTitle(content: string): string {
  const text = stripHtml(content);
  return text.slice(0, 50) + (text.length > 50 ? '…' : '');
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // all | news | announcement
  const search = searchParams.get('search')?.trim() ?? '';

  const where: { type?: string; title?: { contains: string } } = {};
  if (type && type !== 'all') where.type = type;
  if (search) where.title = { contains: search };

  const list = await prisma.publication.findMany({
    where,
    orderBy: { publishAt: 'desc' },
  });

  return NextResponse.json({
    publications: list.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      publishAt: p.publishAt.toISOString(),
      viewsCount: p.viewsCount,
      ratingSum: p.ratingSum,
      ratingCount: p.ratingCount,
      allowComments: p.allowComments,
      allowRating: p.allowRating,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = publicationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const title = data.title?.trim() || fallbackTitle(data.content);
  const publishAt = new Date(data.publishAt);

  const pub = await prisma.publication.create({
    data: {
      title,
      type: data.type,
      status: data.status ?? 'active',
      publishAt,
      teaser: data.teaser?.trim() || null,
      content: data.content,
      keywords: data.keywords?.trim() || null,
      allowComments: data.allowComments ?? true,
      allowRating: data.allowRating ?? true,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'publication.create',
    entity: 'Publication',
    entityId: pub.id,
    diff: { title: pub.title, type: pub.type },
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
