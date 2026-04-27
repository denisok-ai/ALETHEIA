/**
 * Admin: данные для графика посещений — уникальные посетители по дням выбранного месяца.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1), 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid year or month' },
      { status: 400 }
    );
  }

  const dateFrom = new Date(year, month - 1, 1);
  const dateTo = new Date(year, month, 0, 23, 59, 59, 999);
  const daysInMonth = dateTo.getDate();

  const sessions = await prisma.visitLog.findMany({
    where: {
      loginAt: { gte: dateFrom, lte: dateTo },
    },
    select: { userId: true, loginAt: true },
  });

  const uniqueByDay: Record<number, Set<string>> = {};
  for (let d = 1; d <= daysInMonth; d++) uniqueByDay[d] = new Set();

  for (const s of sessions) {
    const day = s.loginAt.getDate();
    if (day >= 1 && day <= daysInMonth) uniqueByDay[day].add(s.userId);
  }

  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return { day, uniqueVisitors: uniqueByDay[day]?.size ?? 0 };
  });

  return NextResponse.json({
    year,
    month,
    data,
  });
}
