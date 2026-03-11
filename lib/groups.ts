/**
 * Helpers for hierarchical groups: inherited moderator access.
 */
import { prisma } from '@/lib/db';

/**
 * Returns true if the user is a moderator of the given group or any of its ancestors.
 * Used for inherited access: moderator of parent => moderator of all children.
 */
export async function isModeratorOfGroupOrAncestor(
  userId: string,
  groupId: string
): Promise<boolean> {
  let currentId: string | null = groupId;
  while (currentId) {
    const membership = await prisma.userGroup.findUnique({
      where: { userId_groupId: { userId, groupId: currentId } },
      select: { role: true },
    });
    if (membership?.role === 'moderator') return true;
    const row: { parentId: string | null } | null = await prisma.group.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = row?.parentId ?? null;
  }
  return false;
}

/**
 * Get full breadcrumb path for a group (root -> ... -> parent -> self).
 */
export async function getGroupBreadcrumbs(groupId: string): Promise<Array<{ id: string; name: string }>> {
  const path: Array<{ id: string; name: string }> = [];
  let currentId: string | null = groupId;
  while (currentId) {
    const row: { id: string; name: string; parentId: string | null } | null = await prisma.group.findUnique({
      where: { id: currentId },
      select: { id: true, name: true, parentId: true },
    });
    if (!row) break;
    path.unshift({ id: row.id, name: row.name });
    currentId = row.parentId;
  }
  return path;
}
