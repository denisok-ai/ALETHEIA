/**
 * Admin: статистика посещений за период — пользователь → количество сессий.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';
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

  // Агрегирует и листает БД, а не Node.
  //
  // Раньше сюда вычитывалось до 50 000 записей, подсчёт, поиск, сортировка и
  // нарезка страниц делались в памяти — и так на КАЖДЫЙ клик по страницам.
  // Хуже того, лимит 50 000 был не только нагрузкой: портал шлёт ping каждые
  // 120 секунд на каждого залогиненного, и при нескольких сотнях студентов
  // потолок выбирался меньше чем за сутки — после чего число визитов и общее
  // количество становились МОЛЧА НЕВЕРНЫМИ, без всякого признака обрезки.

  // Поиск идёт по имени и почте, поэтому подходящих пользователей находим
  // заранее. lower() в SQL — сравнение регистронезависимое, как было в JS
  // (prisma contains в SQLite регистр учитывает).
  let userIdFilter: string[] | null = null;
  if (search) {
    const matched = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT u.id FROM "User" u
                 LEFT JOIN "Profile" p ON p.userId = u.id
                 WHERE lower(u.email) LIKE ${'%' + search + '%'}
                    OR lower(COALESCE(u.displayName, '')) LIKE ${'%' + search + '%'}
                    OR lower(COALESCE(p.displayName, '')) LIKE ${'%' + search + '%'}`
    );
    userIdFilter = matched.map((m) => m.id);
    if (userIdFilter.length === 0) {
      return NextResponse.json({
        period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
        items: [],
        pagination: { page, limit, total: 0 },
      });
    }
  }

  const visitWhere = {
    loginAt: { gte: dateFrom, lte: dateTo },
    ...(userIdFilter ? { userId: { in: userIdFilter } } : {}),
  };

  const grouped = await prisma.visitLog.groupBy({
    by: ['userId'],
    where: visitWhere,
    _count: { _all: true },
    // Вторичный ключ обязателен: у пользователей с одинаковым числом визитов
    // порядок иначе не определён, и при листании страниц одни строки могли бы
    // повторяться, а другие — пропадать. При подсчёте в памяти это было не
    // видно, потому что нарезка шла по одному и тому же массиву.
    orderBy: [{ _count: { userId: 'desc' } }, { userId: 'asc' }],
    skip: offset,
    take: limit,
  });

  // Всего уникальных посетителей за период — для постраничной навигации.
  const totalRows = await prisma.visitLog.groupBy({
    by: ['userId'],
    where: visitWhere,
  });
  const total = totalRows.length;

  const countByUser: Record<string, number> = {};
  for (const g of grouped) countByUser[g.userId] = g._count._all;
  const userIds = grouped.map((g) => g.userId);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = userIds.map((userId) => {
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

  // Поиск, сортировка и нарезка страниц уже выполнены в БД — здесь только
  // подстановка имён к готовой странице результатов.
  return NextResponse.json({
    period: { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() },
    items: rows,
    pagination: { page, limit, total },
  });
}
