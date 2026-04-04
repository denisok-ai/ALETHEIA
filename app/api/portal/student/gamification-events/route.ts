/**
 * Студент: журнал изменений заряда (геймификация).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

function safeParseMeta(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (role !== 'user') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get('take') ?? '50', 10) || 50));
  const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0);

  const [items, total] = await Promise.all([
    prisma.gamificationXpEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.gamificationXpEvent.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    items: items.map((row) => ({
      id: row.id,
      source: row.source,
      delta: row.delta,
      balanceAfter: row.balanceAfter,
      meta: safeParseMeta(row.meta),
      createdAt: row.createdAt.toISOString(),
    })),
    total,
  });
}
