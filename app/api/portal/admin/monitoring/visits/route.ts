/**
 * Admin: статистика посещений за период — пользователь → количество сессий.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const dateFrom = parseDate(
    searchParams.get('dateFrom'),
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const dateTo = parseDate(searchParams.get('dateTo'), new Date());
  const search = (searchParams.get('search') ?? '').trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const sessions = await prisma.visitLog.findMany({
    where: {
      loginAt: { gte: dateFrom, lte: dateTo },
    },
    select: { userId: true },
  });

  const countByUser: Record<string, number> = {};
  for (const s of sessions) {
    countByUser[s.userId] = (countByUser[s.userId] ?? 0) + 1;
  }
  const userIds = Object.keys(countByUser);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  let rows = userIds.map((userId) => {
    const u = userMap.get(userId);
    const displayName = u?.displayName ?? u?.email ?? userId;
    const email = u?.email ?? '';
    return {
      userId,
      displayName,
      email,
      visitsCount: countByUser[userId] ?? 0,
    };
  });

  if (search) {
    rows = rows.filter(
      (r) =>
        r.displayName?.toLowerCase().includes(search) ||
        r.email?.toLowerCase().includes(search)
    );
  }

  rows.sort((a, b) => b.visitsCount - a.visitsCount);
  const total = rows.length;
  const items = rows.slice(offset, offset + limit);

  return NextResponse.json({
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    items,
    pagination: { page, limit, total },
  });
}
