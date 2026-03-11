/**
 * Admin: manually confirm payment — set order paid, create enrollment + notification (same logic as webhook).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/audit';

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
    return NextResponse.json({ error: 'Order already paid' }, { status: 400 });
  }

  const service = await prisma.service.findFirst({
    where: {
      paykeeperTariffId: order.tariffId,
      isActive: true,
    },
    select: { courseId: true },
  });

  const courseId = service?.courseId;
  let userId: string | null = null;

  const user = await prisma.user.findFirst({
    where: { email: order.clientEmail },
    select: { id: true },
  });
  userId = user?.id ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'paid', paidAt: new Date(), userId: userId ?? undefined },
    });
    if (courseId && userId) {
      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId },
        update: {},
      });
      await tx.notification.create({
        data: {
          userId,
          type: 'enrollment',
          content: JSON.stringify({ course_id: courseId }),
        },
      });
    }
  });

  await writeAuditLog({
    actorId: auth.userId,
    action: 'order.confirm_payment',
    entity: 'Order',
    entityId: String(orderId),
    diff: { orderNumber: order.orderNumber, amount: order.amount },
  });

  return NextResponse.json({ success: true });
}
