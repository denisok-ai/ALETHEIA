/**
 * Admin: детализация посещений по пользователю — список сессий (IP, вход, выход).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

/** Дата из поля type=date (YYYY-MM-DD): начало календарного дня в локальной TZ сервера */
function startOfDayFromYmd(s: string | null, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return new Date(fallback);
  const [y, m, d] = s.trim().split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(fallback);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Конец календарного дня (включительно), чтобы сессии за «сегодня» не отфильтровывались из-за 00:00 UTC */
function endOfDayFromYmd(s: string | null, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.trim())) return new Date(fallback);
  const [y, m, d] = s.trim().split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(fallback);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const defaultTo = new Date();
  const dateFrom = startOfDayFromYmd(searchParams.get('dateFrom'), defaultFrom);
  const dateTo = endOfDayFromYmd(searchParams.get('dateTo'), defaultTo);

  if (dateFrom > dateTo) {
    return NextResponse.json({ error: 'Некорректный период: дата «с» позже «по»' }, { status: 400 });
  }

  const sessions = await prisma.visitLog.findMany({
    where: {
      userId,
      loginAt: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { loginAt: 'desc' },
    select: {
      id: true,
      loginAt: true,
      lastActivityAt: true,
      logoutAt: true,
      ipAddress: true,
      userAgent: true,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });

  return NextResponse.json({
    userId,
    displayName: user?.displayName ?? user?.email ?? null,
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    items: sessions.map((s) => ({
      id: s.id,
      loginAt: s.loginAt.toISOString(),
      lastActivityAt: s.lastActivityAt.toISOString(),
      logoutAt: s.logoutAt?.toISOString() ?? null,
      ipAddress: s.ipAddress ?? null,
      userAgent: s.userAgent ?? null,
    })),
  });
}
