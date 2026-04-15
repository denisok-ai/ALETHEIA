/**
 * Admin: список активных фоновых задач (рассылки, массовая выдача сертификатов и т.п.).
 */
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getActiveTasks } from '@/lib/background-tasks';

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = getActiveTasks();
  const initiatorIds = Array.from(new Set(list.map((t) => t.initiatorId)));
  const users =
    initiatorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: initiatorIds } },
          select: { id: true, displayName: true, email: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const items = list.map((t) => ({
    id: t.id,
    name: t.name,
    initiatorId: t.initiatorId,
    initiatorName: userMap.get(t.initiatorId)?.displayName ?? userMap.get(t.initiatorId)?.email ?? t.initiatorId,
    progress: t.progress,
    startedAt: t.startedAt.toISOString(),
  }));

  return NextResponse.json({ items });
}
