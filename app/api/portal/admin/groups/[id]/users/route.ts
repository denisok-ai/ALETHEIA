/**
 * Admin: list users in group (GET) with role, add user (POST), remove user (DELETE).
 * Moderator role is used for inherited access to child groups.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { assignUserSchema } from '@/lib/validations/group';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const group = await prisma.group.findUnique({
    where: { id: groupId, moduleType: 'user' },
    include: {
      userGroups: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      },
    },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    users: group.userGroups.map((ug) => ({
      userId: ug.user.id,
      email: ug.user.email,
      displayName: ug.user.profile?.displayName ?? null,
      role: ug.role,
      joinedAt: ug.joinedAt.toISOString(),
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
    where: { id: groupId, moduleType: 'user' },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = assignUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    include: { profile: true },
  });
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId: user.id, groupId } },
    create: { userId: user.id, groupId, role: parsed.data.role },
    update: { role: parsed.data.role },
  });

  return NextResponse.json({ ok: true, userId: user.id, groupId, role: parsed.data.role });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: groupId } = await params;
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  await prisma.userGroup.deleteMany({
    where: { groupId, userId },
  });
  return NextResponse.json({ ok: true });
}
