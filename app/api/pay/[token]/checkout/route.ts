import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createPayKeeperInvoice } from '@/lib/paykeeper';
import { buildPaykeeperServiceNamePayload } from '@/lib/paykeeper/fiscal';
import { checkRateLimit } from '@/lib/rate-limit';
import { writePaykeeperIntegrationLog } from '@/lib/paykeeper-integration-log';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const rateLimited = checkRateLimit(req, 'pay-checkout', 10);
  if (rateLimited) return rateLimited;

  const link = await prisma.paymentLink.findUnique({
    where: { token: params.token },
    include: { product: true },
  });
  if (!link) {
    return NextResponse.json({ error: 'Ссылка не найдена' }, { status: 404 });
  }
  if (link.status !== 'pending') {
    return NextResponse.json({ error: 'Ссылка уже оплачена или истекла' }, { status: 400 });
  }
  const now = new Date();
  if (link.product.expiresAt && link.product.expiresAt < now) {
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { status: 'expired' },
    });
    return NextResponse.json({ error: 'Срок действия ссылки истёк' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const clientEmail = body.clientEmail || link.clientEmail || '';
  const clientName = body.clientName || link.clientName || '';
  if (!clientEmail) {
    return NextResponse.json({ error: 'Укажите email' }, { status: 400 });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(clientEmail)) {
    return NextResponse.json({ error: 'Некорректный email' }, { status: 400 });
  }
  if (link.product.priceRub < 10) {
    return NextResponse.json({ error: 'Минимальная сумма оплаты — 10 ₽' }, { status: 400 });
  }
  const orderNumber = `PL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      tariffId: `personal-${link.productId}`,
      amount: link.product.priceRub,
      clientEmail,
      clientName,
      status: 'pending',
    },
  });
  const siteUrl = process.env.NEXT_PUBLIC_URL || 'https://avaterra.pro';
  const successRedirectUrl = `${siteUrl}/pay/${params.token}/success`;
  const serviceNamePayload = await buildPaykeeperServiceNamePayload(
    link.product.name,
    link.product.priceRub,
    successRedirectUrl
  );
  try {
    const inv = await createPayKeeperInvoice({
      sum: link.product.priceRub,
      orderid: orderNumber,
      clientid: clientEmail,
      service_name: serviceNamePayload,
      client_email: clientEmail,
      successRedirectUrl,
    });
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: {
        clientEmail,
        clientName,
        orderId: order.id,
        paykeeperInvoiceId: inv.invoiceId,
        paykeeperInvoiceUrl: inv.paymentUrl,
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paykeeperInvoiceId: inv.invoiceId,
        paykeeperInvoiceUrl: inv.paymentUrl,
      },
    });
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'payment_link.checkout',
      status: 'success',
      orderNumber,
      message: `Персональный товар: ${link.product.name}, ${link.product.priceRub}₽`,
    });
    return NextResponse.json({ invoiceUrl: inv.paymentUrl, orderNumber });
  } catch (pkErr) {
    const msg = pkErr instanceof Error ? pkErr.message : 'Ошибка PayKeeper';
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    await writePaykeeperIntegrationLog({
      direction: 'outbound',
      event: 'payment_link.checkout',
      status: 'error',
      orderNumber,
      message: msg.slice(0, 500),
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
