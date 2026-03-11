/**
 * Admin: детализация посещений по пользователю — список сессий (IP, вход, выход).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

function parseDate(s: string | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { userId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const dateFrom = parseDate(
    searchParams.get('dateFrom'),
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const dateTo = parseDate(searchParams.get('dateTo'), new Date());

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
