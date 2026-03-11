/**
 * Admin: список пользователей онлайн — сводка по ролям и детальный список активных сессий.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ONLINE_TIMEOUT_MINUTES } from '@/lib/visits';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') ?? '';
  const roleFilter = searchParams.get('role') ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const cutoff = new Date(Date.now() - ONLINE_TIMEOUT_MINUTES * 60 * 1000);

  const whereActive = {
    logoutAt: null,
    lastActivityAt: { gte: cutoff },
  };

  const activeSessions = await prisma.visitLog.findMany({
    where: whereActive,
    orderBy: { lastActivityAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          profile: { select: { role: true } },
        },
      },
    },
  });

  const byRole: Record<string, number> = {};
  for (const s of activeSessions) {
    const role = s.user.profile?.role ?? 'user';
    byRole[role] = (byRole[role] ?? 0) + 1;
  }
  const summary = [
    { role: 'admin', label: 'Администратор', count: byRole['admin'] ?? 0 },
    { role: 'manager', label: 'Менеджер', count: byRole['manager'] ?? 0 },
    { role: 'user', label: 'Слушатель', count: byRole['user'] ?? 0 },
  ];

  let list = activeSessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    displayName: s.user.displayName ?? s.user.email,
    email: s.user.email,
    role: s.user.profile?.role ?? 'user',
    loginAt: s.loginAt.toISOString(),
    lastActivityAt: s.lastActivityAt.toISOString(),
    ipAddress: s.ipAddress ?? null,
  }));

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (r) =>
        r.displayName?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q)
    );
  }
  if (roleFilter) {
    list = list.filter((r) => r.role === roleFilter);
  }

  const total = list.length;
  const items = list.slice(offset, offset + limit);

  return NextResponse.json({
    summary,
    items,
    pagination: { page, limit, total },
  });
}
