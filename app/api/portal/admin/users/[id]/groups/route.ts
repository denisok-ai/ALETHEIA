/**
 * Admin: list groups this user belongs to (GET), add to group (POST), remove from group (DELETE).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userGroupRoleEnum } from '@/lib/validations/group';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userGroups: {
        include: { group: { select: { id: true, name: true, parentId: true } } },
      },
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    groups: user.userGroups.map((ug) => ({
      id: ug.group.id,
      name: ug.group.name,
      parentId: ug.group.parentId,
      role: ug.role,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  let body: { groupId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const groupId = body.groupId?.trim();
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });
  const roleParsed = userGroupRoleEnum.safeParse(body.role ?? 'member');
  const role = roleParsed.success ? roleParsed.data : 'member';

  const [user, group] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.group.findUnique({ where: { id: groupId, moduleType: 'user' } }),
  ]);
  if (!user) return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  if (!group) return NextResponse.json({ error: 'Группа не найдена' }, { status: 404 });

  await prisma.userGroup.upsert({
    where: { userId_groupId: { userId, groupId } },
    create: { userId, groupId, role },
    update: { role },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: userId } = await params;
  const groupId = request.nextUrl.searchParams.get('groupId');
  if (!groupId) return NextResponse.json({ error: 'groupId required' }, { status: 400 });

  await prisma.userGroup.deleteMany({ where: { userId, groupId } });
  return NextResponse.json({ ok: true });
}
