/**
 * Admin: export orders as CSV.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const allCols = ['orderNumber', 'tariffId', 'amount', 'clientEmail', 'clientPhone', 'status', 'paidAt', 'createdAt'];
  const requested = request.nextUrl.searchParams.get('fields')?.trim();
  const cols = requested
    ? requested.split(',').map((c) => c.trim()).filter((c) => allCols.includes(c))
    : allCols;
  const finalCols = cols.length > 0 ? cols : allCols;

  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = finalCols.join(',');
  const rows = orders.map((o) =>
    finalCols.map((c) => escape((o as Record<string, unknown>)[c])).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const bom = '\uFEFF';

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
