/**
 * Admin: журнал интеграции PayKeeper (токен, счёт, webhook).
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
  const dateFrom = searchParams.get('dateFrom')?.trim();
  const dateTo = searchParams.get('dateTo')?.trim();
  const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);

  const where: {
    event?: string;
    status?: string;
    orderNumber?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (event) where.event = event;
  if (status) where.status = status;
  if (orderNumber) where.orderNumber = orderNumber;

  if (dateFrom) {
    const d = new Date(dateFrom);
    if (!Number.isNaN(d.getTime())) {
      where.createdAt = { ...where.createdAt, gte: d };
    }
  }
  if (dateTo) {
    const d = new Date(dateTo);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: d };
    }
  }

  const logs = await prisma.paykeeperIntegrationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      direction: l.direction,
      event: l.event,
      status: l.status,
      orderNumber: l.orderNumber,
      invoiceUrl: l.invoiceUrl,
      httpStatus: l.httpStatus,
      message: l.message,
      payload: l.payload,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
