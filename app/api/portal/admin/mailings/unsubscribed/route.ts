/**
 * Admin: список отписавшихся от рассылок (JSON или CSV).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const list = await prisma.mailingUnsubscribe.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const format = request.nextUrl.searchParams.get('format');
  if (format === 'csv') {
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = 'email,createdAt';
    const rows = list.map((r) => `${escape(r.email)},${escape(r.createdAt.toISOString())}`);
    const csv = [header, ...rows].join('\n');
    const bom = '\uFEFF';
    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="unsubscribed-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    list: list.map((r) => ({
      id: r.id,
      email: r.email,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
