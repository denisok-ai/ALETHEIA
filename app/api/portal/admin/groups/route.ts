/**
 * Admin: list groups (GET) by moduleType, create group (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { groupCreateSchema } from '@/lib/validations/group';
import { writeAuditLog } from '@/lib/audit';

const MODULE_TYPES = ['course', 'media', 'user'] as const;
const GROUP_TYPES = ['static', 'dynamic'] as const;
const ACCESS_TYPES = ['common', 'personal'] as const;

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const moduleType = searchParams.get('moduleType')?.toLowerCase();
  if (!moduleType || !MODULE_TYPES.includes(moduleType as (typeof MODULE_TYPES)[number])) {
    return NextResponse.json({ error: 'moduleType required: course | media | user' }, { status: 400 });
  }

  const list = await prisma.group.findMany({
    where: { moduleType },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      parent: { select: { id: true, name: true } },
      _count: {
        select: { children: true, courseGroups: true, mediaGroups: true, userGroups: true },
      },
    },
  });

  return NextResponse.json({
    groups: list.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      parentId: g.parentId,
      parent: g.parent,
      moduleType: g.moduleType,
      type: g.type,
      accessType: g.accessType,
      displayOrder: g.displayOrder,
      smallIcon: g.smallIcon,
      largeIcon: g.largeIcon,
      showSubgroupsMode: g.showSubgroupsMode,
      sourceCourseId: g.sourceCourseId,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      childrenCount: g._count.children,
      coursesCount: g._count.courseGroups,
      mediaCount: g._count.mediaGroups,
      usersCount: g._count.userGroups,
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

  const parsed = groupCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.parentId) {
    const parent = await prisma.group.findFirst({
      where: { id: data.parentId, moduleType: data.moduleType },
    });
    if (!parent) {
      return NextResponse.json({ error: 'Родительская группа не найдена или другой модуль' }, { status: 400 });
    }
  }

  const group = await prisma.group.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      parentId: data.parentId || null,
      moduleType: data.moduleType,
      type: data.type,
      accessType: data.accessType,
      displayOrder: data.displayOrder ?? 0,
      smallIcon: data.smallIcon?.trim() || null,
      largeIcon: data.largeIcon?.trim() || null,
      showSubgroupsMode: data.showSubgroupsMode || null,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'group.create',
    entity: 'Group',
    entityId: group.id,
    diff: { name: group.name, moduleType: group.moduleType },
  });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    description: group.description,
    parentId: group.parentId,
    moduleType: group.moduleType,
    type: group.type,
    accessType: group.accessType,
    displayOrder: group.displayOrder,
    smallIcon: group.smallIcon,
    largeIcon: group.largeIcon,
    showSubgroupsMode: group.showSubgroupsMode,
    sourceCourseId: group.sourceCourseId,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  });
}
