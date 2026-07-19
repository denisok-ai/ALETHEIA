/**
 * Admin: manually confirm payment — та же цепочка, что webhook PayKeeper (`processPaidOrder`).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';

export async function POST(
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
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status === 'paid') {
    return NextResponse.json({ success: true, alreadyPaid: true });
  }
  // Возвращённый или отменённый заказ подтвердить нельзя. Раньше проверялся
  // только статус 'paid', поэтому вызов уходил в processPaidOrder, тот отвечал
  // success (ничего не сделав), а маршрут писал в аудит «оплата подтверждена» —
  // запись, которой не соответствовало ни одно действие. В интерфейсе кнопка
  // для таких статусов скрыта, но API оставался доступен напрямую.
  if (order.status === 'refunded' || order.status === 'cancelled') {
    return NextResponse.json(
      {
        error: `Заказ в статусе «${order.status}» — подтверждение оплаты невозможно.`,
        success: false,
      },
      { status: 409 }
    );
  }

  const result = await processPaidOrder(order.orderNumber);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Ошибка обработки оплаты', success: false },
      { status: 500 }
    );
  }

  await writeAuditLog({
    actorId: auth.userId,
    action: 'order.confirm_payment',
    entity: 'Order',
    entityId: String(orderId),
    diff: {
      orderNumber: order.orderNumber,
      amount: order.amount,
      enrollmentCreated: result.enrollmentCreated,
      warnings: result.warnings,
    },
  });

  return NextResponse.json({
    success: true,
    enrollmentCreated: result.enrollmentCreated,
    userId: result.userId,
    userWasAutoCreated: result.userWasAutoCreated,
    emailKind: result.emailKind,
    warnings: result.warnings,
  });
}
