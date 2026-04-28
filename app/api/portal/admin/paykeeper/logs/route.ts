/**
 * Admin: журнал PayKeeperIntegrationLog с фильтрами.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const event = searchParams.get('event')?.trim();
  const status = searchParams.get('status')?.trim();
  const orderNumber = searchParams.get('orderNumber')?.trim();
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

  const rows = await prisma.paykeeperIntegrationLog.findMany({
    where: {
      ...(event ? { event: { contains: event } } : {}),
      ...(status ? { status } : {}),
      ...(orderNumber ? { orderNumber } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    logs: rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      event: r.event,
      status: r.status,
      orderNumber: r.orderNumber,
      invoiceUrl: r.invoiceUrl,
      httpStatus: r.httpStatus,
      message: r.message,
      payload: r.payload,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
