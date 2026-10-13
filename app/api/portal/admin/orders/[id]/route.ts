/**
 * Admin: get order (GET), cancel order (PATCH).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getPayKeeperConfigFromSettings, reversePayment } from '@/lib/paykeeper';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';
import { getYooKassaConfigFromSettings } from '@/lib/yookassa/config';
import { createYooKassaRefund } from '@/lib/yookassa/client';

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
      paymentProvider: order.paymentProvider ?? null,
      providerPaymentId: order.providerPaymentId ?? null,
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
    // Возврат идёт через тот провайдер, которым заказ был оплачен (не через текущую настройку).
    const isYooKassa = order.paymentProvider === 'yookassa';
    const cfg = isYooKassa ? null : await getPayKeeperConfigFromSettings();
    const ykCfg = isYooKassa ? await getYooKassaConfigFromSettings() : null;
    if (isYooKassa) {
      if (!order.providerPaymentId) {
        return NextResponse.json(
          { error: 'Нет идентификатора платежа ЮKassa — возврат через API невозможен.' },
          { status: 400 }
        );
      }
      if (!ykCfg) {
        return NextResponse.json({ error: 'ЮKassa не настроена — возврат через API невозможен' }, { status: 400 });
      }
    } else {
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
      if (isYooKassa && ykCfg && order.providerPaymentId) {
        const newRefundedRub = order.refundedAmountRub + requested;
        await createYooKassaRefund(ykCfg, {
          paymentId: order.providerPaymentId,
          amountRub: requested,
          description: `Возврат заказа ${order.orderNumber}`,
          // Повтор того же запроса (сетевой сбой) не создаст второй возврат.
          idempotenceKey: `refund-${order.orderNumber}-${newRefundedRub}`,
        });
      } else if (cfg && order.paykeeperPaymentId) {
        await reversePayment(cfg, {
          paymentId: order.paykeeperPaymentId,
          amount: requested.toFixed(2),
          partial,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : isYooKassa ? 'ЮKassa refund failed' : 'PayKeeper reverse failed';
      await writePaykeeperIntegrationLog({
        direction: 'outbound',
        event: isYooKassa ? 'yookassa.refund' : 'payment.reverse',
        status: 'error',
        orderNumber: order.orderNumber,
        message: msg.slice(0, 500),
      });
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const service = await prisma.service.findFirst({
      where: { paykeeperTariffId: order.tariffId, isActive: true },
      select: { courseId: true },
    });

    const newRefunded = order.refundedAmountRub + requested;
    const fullyRefunded = newRefunded >= order.amount;

    await prisma.$transaction(async (tx) => {
      if (!isYooKassa) {
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
      }
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
