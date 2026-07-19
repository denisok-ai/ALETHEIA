/**
 * Admin: данные для графика посещений — уникальные посетители по дням выбранного месяца.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';
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

  // Считает БД, а не Node. Раньше сюда грузились ВСЕ записи посещений за месяц
  // (без take) — ради 30 чисел. Портал шлёт ping каждые 120 секунд на каждого
  // залогиненного, поэтому таблица растёт быстро: при трёх сотнях активных
  // студентов это миллионы строк в куче процесса на один запрос графика.
  // Уникальные пользователи по дням считаются одним GROUP BY.
  const rows = await prisma.$queryRaw<{ day: string; cnt: bigint | number }[]>(
    Prisma.sql`SELECT strftime('%d', datetime(loginAt / 1000, 'unixepoch', 'localtime')) AS day,
                      COUNT(DISTINCT userId) AS cnt
               FROM "VisitLog"
               WHERE loginAt >= ${dateFrom.getTime()} AND loginAt <= ${dateTo.getTime()}
               GROUP BY day`
  );

  const countByDay: Record<number, number> = {};
  for (let d = 1; d <= daysInMonth; d++) countByDay[d] = 0;
  for (const r of rows) {
    const day = parseInt(r.day, 10);
    if (day >= 1 && day <= daysInMonth) countByDay[day] = Number(r.cnt);
  }

  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return { day, uniqueVisitors: countByDay[day] ?? 0 };
  });

  return NextResponse.json({
    year,
    month,
    data,
  });
}
