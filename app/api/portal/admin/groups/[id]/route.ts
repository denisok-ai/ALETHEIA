/**
 * Admin: get (GET), update (PATCH), delete (DELETE) a group.
 * DELETE body: { deleteNestedItems?: boolean } — true = удалить дочерние группы и связи; false = отвязать дочерние группы и элементы.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { groupUpdateSchema, groupDeleteSchema } from '@/lib/validations/group';
import { writeAuditLog } from '@/lib/audit';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { children: true, courseGroups: true, mediaGroups: true, userGroups: true } },
    },
  });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    id: group.id,
    name: group.name,
    description: group.description,
    parentId: group.parentId,
    parent: group.parent,
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
    childrenCount: group._count.children,
    coursesCount: group._count.courseGroups,
    mediaCount: group._count.mediaGroups,
    usersCount: group._count.userGroups,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.group.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = groupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      return NextResponse.json({ error: 'Группа не может быть родителем самой себя' }, { status: 400 });
    }
    const parent = await prisma.group.findFirst({
      where: { id: data.parentId, moduleType: existing.moduleType },
    });
    if (!parent) {
      return NextResponse.json({ error: 'Родительская группа не найдена' }, { status: 400 });
    }
  }

  const group = await prisma.group.update({
    where: { id },
    data: {
      name: data.name?.trim(),
      description: data.description !== undefined ? (data.description?.trim() || null) : undefined,
      parentId: data.parentId !== undefined ? data.parentId : undefined,
      type: data.type,
      accessType: data.accessType,
      displayOrder: data.displayOrder,
      smallIcon: data.smallIcon !== undefined ? (data.smallIcon?.trim() || null) : undefined,
      largeIcon: data.largeIcon !== undefined ? (data.largeIcon?.trim() || null) : undefined,
      showSubgroupsMode: data.showSubgroupsMode,
    },
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'group.update',
    entity: 'Group',
    entityId: id,
    diff: { name: group.name },
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
    updatedAt: group.updatedAt.toISOString(),
  });
}

async function deleteGroupRecursive(groupId: string) {
  const children = await prisma.group.findMany({ where: { parentId: groupId }, select: { id: true } });
  for (const ch of children) {
    await deleteGroupRecursive(ch.id);
  }
  await prisma.courseGroup.deleteMany({ where: { groupId } });
  await prisma.mediaGroup.deleteMany({ where: { groupId } });
  await prisma.userGroup.deleteMany({ where: { groupId } });
  await prisma.group.delete({ where: { id: groupId } });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.group.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let deleteNestedItems = false;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = groupDeleteSchema.safeParse(body);
    if (parsed.success && parsed.data.deleteNestedItems) deleteNestedItems = true;
  } catch {
    // no body
  }

  if (deleteNestedItems && existing._count.children > 0) {
    await deleteGroupRecursive(id);
  } else {
    if (existing._count.children > 0) {
      await prisma.group.updateMany({ where: { parentId: id }, data: { parentId: null } });
    }
    await prisma.courseGroup.deleteMany({ where: { groupId: id } });
    await prisma.mediaGroup.deleteMany({ where: { groupId: id } });
    await prisma.userGroup.deleteMany({ where: { groupId: id } });
    await prisma.group.delete({ where: { id } });
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: 'group.delete',
    entity: 'Group',
    entityId: id,
    diff: { name: existing.name, moduleType: existing.moduleType },
  });

  return NextResponse.json({ ok: true });
}
