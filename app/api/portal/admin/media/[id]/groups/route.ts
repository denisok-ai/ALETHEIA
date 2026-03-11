/**
 * Admin: list groups this media belongs to (GET), add to group (POST), remove from group (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: mediaId } = await params;
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      mediaGroups: {
        include: { group: { select: { id: true, name: true, parentId: true } } },
      },
    },
  });
  if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    groups: media.mediaGroups.map((mg) => ({
      id: mg.group.id,
      name: mg.group.name,
      parentId: mg.group.parentId,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: mediaId } = await params;
  let body: { groupId: string; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const groupId = body.groupId?.trim();
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  const [media, group] = await Promise.all([
    prisma.media.findUnique({ where: { id: mediaId } }),
    prisma.group.findUnique({ where: { id: groupId, moduleType: 'media' } }),
  ]);
  if (!media) return NextResponse.json({ error: 'Ресурс не найден' }, { status: 404 });
  if (!group) return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 });

  await prisma.mediaGroup.upsert({
    where: { mediaId_groupId: { mediaId, groupId } },
    create: { mediaId, groupId, sortOrder: body.sortOrder ?? 0 },
    update: { sortOrder: body.sortOrder ?? 0 },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: mediaId } = await params;
  const groupId = request.nextUrl.searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  await prisma.mediaGroup.deleteMany({ where: { mediaId, groupId } });
  return NextResponse.json({ ok: true });
}
