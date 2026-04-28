/**
 * Admin: get order (GET), cancel order (PATCH).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPayKeeperConfigFromSettings, reversePayment } from '@/lib/paykeeper';

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
      paykeeperInvoiceId: order.paykeeperInvoiceId ?? null,
      paykeeperInvoiceUrl: order.paykeeperInvoiceUrl ?? null,
      paykeeperPaymentId: order.paykeeperPaymentId ?? null,
      paykeeperStatus: order.paykeeperStatus ?? null,
      refundedAmountRub: order.refundedAmountRub,
      lastSyncedAt: order.lastSyncedAt?.toISOString() ?? null,
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

  let body: { status?: string; refundAmountRub?: number };
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
    const cfg = await getPayKeeperConfigFromSettings();
    if (!order.paykeeperPaymentId) {
      return NextResponse.json(
        {
          error:
            'Нет идентификатора платежа PayKeeper. Сначала выполните сверку заказа в разделе «Оплаты» или дождитесь webhook.',
        },
        { status: 400 }
      );
    }
    if (!cfg) {
      return NextResponse.json({ error: 'PayKeeper не настроен — возврат через API невозможен' }, { status: 400 });
    }

    const remaining = order.amount - order.refundedAmountRub;
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Сумма заказа уже полностью возвращена' }, { status: 400 });
    }

    const requested =
      typeof body.refundAmountRub === 'number' && Number.isFinite(body.refundAmountRub)
        ? Math.floor(body.refundAmountRub)
        : remaining;
    if (requested <= 0 || requested > remaining) {
      return NextResponse.json(
        { error: `Сумма возврата должна быть от 1 до ${remaining} ₽` },
        { status: 400 }
      );
    }

    const partial = requested < remaining;

    try {
      await reversePayment(cfg, {
        paymentId: order.paykeeperPaymentId,
        amount: requested.toFixed(2),
        partial,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PayKeeper reverse failed';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const service = await prisma.service.findFirst({
      where: { paykeeperTariffId: order.tariffId, isActive: true },
      select: { courseId: true },
    });

    const newRefunded = order.refundedAmountRub + requested;
    const fullyRefunded = newRefunded >= order.amount;

    await prisma.$transaction(async (tx) => {
      await tx.paykeeperRefundRecord.create({
        data: {
          orderId: order.id,
          paykeeperPaymentId: order.paykeeperPaymentId!,
          amountRub: requested,
          partial,
          status: 'requested',
          resultMsg: 'reverse API accepted',
        },
      });
      await tx.order.update({
        where: { id: orderId },
        data: {
          refundedAmountRub: newRefunded,
          status: fullyRefunded ? 'refunded' : order.status,
        },
      });
      if (fullyRefunded && service?.courseId && order.userId) {
        await tx.enrollment.updateMany({
          where: { userId: order.userId, courseId: service.courseId },
          data: { accessClosed: true },
        });
      }
    });
    return NextResponse.json({ success: true, refundedAmountRub: requested, fullyRefunded });
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'cancelled' },
  });

  return NextResponse.json({ success: true });
}
