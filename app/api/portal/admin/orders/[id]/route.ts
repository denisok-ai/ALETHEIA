/**
 * Admin: get order (GET), cancel order (PATCH).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (Number.isNaN(orderId)) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      tariffId: order.tariffId,
      amount: order.amount,
      clientEmail: order.clientEmail,
      clientPhone: order.clientPhone,
      status: order.status,
      userId: order.userId,
      paidAt: order.paidAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (Number.isNaN(orderId)) return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = body.status;
  if (status !== 'cancelled' && status !== 'refunded') {
    return NextResponse.json({ error: 'Expected { status: "cancelled" | "refunded" }' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (status === 'refunded') {
    if (order.status !== 'paid') {
      return NextResponse.json({ error: 'Возврат возможен только для оплаченных заказов' }, { status: 400 });
    }
    const service = await prisma.service.findFirst({
      where: { paykeeperTariffId: order.tariffId, isActive: true },
      select: { courseId: true },
    });
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'refunded' },
      });
      if (service?.courseId && order.userId) {
        await tx.enrollment.updateMany({
          where: { userId: order.userId, courseId: service.courseId },
          data: { accessClosed: true },
        });
      }
    });
    return NextResponse.json({ success: true });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'cancelled' },
  });

  return NextResponse.json({ success: true });
}
