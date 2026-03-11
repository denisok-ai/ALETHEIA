/**
 * Admin: group hierarchy tree for sidebar (GET ?moduleType=course|media|user).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const MODULE_TYPES = ['course', 'media', 'user'] as const;

export interface GroupTreeNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  moduleType: string;
  type: string;
  accessType: string;
  displayOrder: number;
  childrenCount: number;
  coursesCount: number;
  mediaCount: number;
  usersCount: number;
  children: GroupTreeNode[];
}

function buildTree(groups: Array<{
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  moduleType: string;
  type: string;
  accessType: string;
  displayOrder: number;
  _count: { children: number; courseGroups: number; mediaGroups: number; userGroups: number };
}>, parentId: string | null): GroupTreeNode[] {
  return groups
    .filter((g) => g.parentId === parentId)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    .map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      parentId: g.parentId,
      moduleType: g.moduleType,
      type: g.type,
      accessType: g.accessType,
      displayOrder: g.displayOrder,
      childrenCount: g._count.children,
      coursesCount: g._count.courseGroups,
      mediaCount: g._count.mediaGroups,
      usersCount: g._count.userGroups,
      children: buildTree(groups, g.id),
    }));
}

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
      _count: {
        select: { children: true, courseGroups: true, mediaGroups: true, userGroups: true },
      },
    },
  });

  const tree = buildTree(list, null);
  return NextResponse.json({ tree });
}
