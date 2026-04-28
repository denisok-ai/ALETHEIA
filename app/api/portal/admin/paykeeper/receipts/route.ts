/**
 * Admin: чеки по платежу PayKeeper (если API доступен).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { fetchReceiptsByPaymentId, getPayKeeperConfigFromSettings } from '@/lib/paykeeper';

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const orderNumber = request.nextUrl.searchParams.get('orderNumber')?.trim();
  if (!orderNumber) return NextResponse.json({ error: 'orderNumber' }, { status: 400 });

  const cfg = await getPayKeeperConfigFromSettings();
  if (!cfg) return NextResponse.json({ error: 'PayKeeper не настроен' }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, paykeeperPaymentId: true },
  });
  if (!order?.paykeeperPaymentId) {
    return NextResponse.json(
      { error: 'Нет paykeeperPaymentId — оплатите или сверьте заказ' },
      { status: 400 }
    );
  }

  try {
    const data = await fetchReceiptsByPaymentId(cfg, order.paykeeperPaymentId);
    if (data != null) {
      await prisma.paykeeperReceiptRecord.create({
        data: {
          orderId: order.id,
          paymentId: order.paykeeperPaymentId,
          source: 'bypaymentid',
          payload: JSON.stringify(data).slice(0, 24_000),
        },
      });
    }
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка запроса чеков';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
