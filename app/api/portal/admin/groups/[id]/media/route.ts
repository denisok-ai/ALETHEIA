/**
 * Admin: list media in group (GET), add media (POST), remove media (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assignMediaSchema } from '@/lib/validations/group';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const group = await prisma.group.findUnique({
    where: { id: groupId, moduleType: 'media' },
    include: {
      mediaGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { media: { select: { id: true, title: true, type: true, mimeType: true } } },
      },
    },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    media: group.mediaGroups.map((mg) => ({
      id: mg.media.id,
      title: mg.media.title,
      type: mg.media.type,
      mimeType: mg.media.mimeType,
      sortOrder: mg.sortOrder,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const group = await prisma.group.findUnique({
    where: { id: groupId, moduleType: 'media' },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = assignMediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'mediaId required' }, { status: 400 });
  }

  const media = await prisma.media.findUnique({ where: { id: parsed.data.mediaId } });
  if (!media) return NextResponse.json({ error: 'Ресурс не найден' }, { status: 404 });

  await prisma.mediaGroup.upsert({
    where: { mediaId_groupId: { mediaId: media.id, groupId } },
    create: { mediaId: media.id, groupId, sortOrder: parsed.data.sortOrder ?? 0 },
    update: { sortOrder: parsed.data.sortOrder ?? 0 },
  });

  return NextResponse.json({ ok: true, mediaId: media.id, groupId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const mediaId = request.nextUrl.searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId required' }, { status: 400 });

  await prisma.mediaGroup.deleteMany({
    where: { groupId, mediaId },
  });
  return NextResponse.json({ ok: true });
}
