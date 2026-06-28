import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createPayKeeperInvoice } from '@/lib/paykeeper';
import { buildPaykeeperServiceNamePayload } from '@/lib/paykeeper/fiscal';
import { notifyInstallmentCreated } from '@/lib/installment-notify';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const plans = await prisma.installmentPlan.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      order: { select: { orderNumber: true, clientEmail: true, clientName: true, amount: true } },
      payments: { orderBy: { partNumber: 'asc' } },
    },
  });
  return NextResponse.json(plans);
}

interface InstallmentBody {
  orderNumber: string;
  totalParts: number;
  firstPaymentNow?: boolean;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body: InstallmentBody = await req.json();
  const { orderNumber, totalParts, firstPaymentNow = true } = body;

  if (!orderNumber || !totalParts || totalParts < 2 || totalParts > 12) {
    return NextResponse.json({ error: 'orderNumber и totalParts (2-12) обязательны' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { orderNumber } });
  if (!order) {
    return NextResponse.json({ error: 'Заказ не найден' }, { status: 404 });
  }
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'Заказ уже оплачен или отменён' }, { status: 400 });
  }

  const existingPlan = await prisma.installmentPlan.findUnique({ where: { orderId: order.id } });
  if (existingPlan) {
    return NextResponse.json({ error: 'Рассрочка уже оформлена' }, { status: 409 });
  }

  const partAmount = Math.floor(order.amount / totalParts);
  const remainder = order.amount - partAmount * totalParts;

  const plan = await prisma.installmentPlan.create({
    data: {
      orderId: order.id,
      totalParts,
      partAmountRub: partAmount,
      status: 'active',
      nextPaymentAt: firstPaymentNow ? new Date() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      payments: {
        create: Array.from({ length: totalParts }, (_, i) => ({
          partNumber: i + 1,
          amountRub: i === 0 ? partAmount + remainder : partAmount,
          status: 'scheduled',
          scheduledAt: i === 0 && firstPaymentNow
            ? new Date()
            : new Date(Date.now() + i * 30 * 24 * 60 * 60 * 1000),
        })),
      },
    },
    include: { payments: true },
  });

  notifyInstallmentCreated({
    orderNumber,
    clientEmail: order.clientEmail,
    clientName: order.clientName,
    totalParts,
    partNumber: 1,
    amountRub: partAmount + remainder,
    planId: plan.id,
  });

  if (firstPaymentNow && plan.payments.length > 0) {
    const firstPayment = plan.payments[0];
    const installmentTitle = `${order.orderNumber} — рассрочка (1/${totalParts})`;
    const serviceNamePayload = await buildPaykeeperServiceNamePayload(
      installmentTitle,
      firstPayment.amountRub
    );
    try {
      const inv = await createPayKeeperInvoice({
        sum: firstPayment.amountRub,
        orderid: `${orderNumber}-I1`,
        clientid: order.clientEmail,
        service_name: serviceNamePayload,
        client_email: order.clientEmail,
      });
      await prisma.installmentPayment.update({
        where: { id: firstPayment.id },
        data: { paykeeperPaymentId: inv.invoiceId },
      });
      return NextResponse.json({
        planId: plan.id,
        firstPaymentUrl: inv.paymentUrl,
        payments: plan.payments.map((p) => ({
          partNumber: p.partNumber,
          amountRub: p.amountRub,
          scheduledAt: p.scheduledAt,
          status: p.status,
        })),
      });
    } catch (pkErr) {
      const msg = pkErr instanceof Error ? pkErr.message : 'Ошибка PayKeeper';
      return NextResponse.json({ error: msg, planId: plan.id }, { status: 500 });
    }
  }

  return NextResponse.json({
    planId: plan.id,
    payments: plan.payments.map((p) => ({
      partNumber: p.partNumber,
      amountRub: p.amountRub,
      scheduledAt: p.scheduledAt,
      status: p.status,
    })),
  });
}
