/**
 * Manager: list tickets with server-side pagination and sorting.
 * GET ?page=0&pageSize=25&sortKey=date|subject|user|status&sortDir=asc|desc
 * Optional ?export=1 returns all (max 5000) for Excel export.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireManagerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

const MAX_EXPORT = 5000;

export async function GET(request: NextRequest) {
  const auth = await requireManagerSession();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const exportMode = searchParams.get('export') === '1';
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));
  const pageSize = exportMode ? MAX_EXPORT : Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10)));
  const sortKey = searchParams.get('sortKey') ?? 'date';
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';

  type OrderBy = { createdAt?: 'asc' | 'desc'; subject?: 'asc' | 'desc'; status?: 'asc' | 'desc'; user?: { email: 'asc' | 'desc' } };
  let orderBy: OrderBy = { createdAt: 'desc' };
  if (sortKey === 'date') orderBy = { createdAt: sortDir };
  else if (sortKey === 'subject') orderBy = { subject: sortDir };
  else if (sortKey === 'status') orderBy = { status: sortDir };
  else if (sortKey === 'user') orderBy = { user: { email: sortDir } };

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      skip: exportMode ? 0 : page * pageSize,
      take: pageSize,
      orderBy,
      include: {
        user: {
          include: { profile: { select: { displayName: true, email: true } } },
        },
      },
    }),
    prisma.ticket.count(),
  ]);

  const rows = tickets.map((t) => ({
    id: t.id,
    userId: t.userId,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    user: t.user
      ? {
          email: t.user.email,
          profile: t.user.profile
            ? { displayName: t.user.profile.displayName, email: t.user.profile.email }
            : null,
        }
      : null,
  }));

  return NextResponse.json({ tickets: rows, total });
}
