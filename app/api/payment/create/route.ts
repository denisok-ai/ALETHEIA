import { NextRequest, NextResponse } from 'next/server';
import { createPayKeeperInvoice } from '@/lib/paykeeper';
import { prisma } from '@/lib/db';
import { getSystemSettings } from '@/lib/settings';
import { nanoid } from 'nanoid';
import { checkRateLimit } from '@/lib/rate-limit';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import {
  assertServiceLinkedToCourse,
  findActiveServiceBySlug,
  findActiveServiceForOrderTariff,
  orderTariffIdForStorage,
} from '@/lib/order-service';

export async function POST(request: NextRequest) {
  const rateLimitRes = checkRateLimit(request, 'payment-create', 10);
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const { tariffId, serviceSlug, email, name, phone } = body;
    if ((!tariffId && !serviceSlug) || !email || !name) {
      return NextResponse.json(
        { error: 'Укажите serviceSlug (или tariffId), email и имя' },
        { status: 400 }
      );
    }

    const slug = typeof serviceSlug === 'string' ? serviceSlug.trim() : '';
    const tid = typeof tariffId === 'string' ? tariffId.trim() : '';

    const service = slug
      ? await findActiveServiceBySlug(slug)
      : tid
        ? await findActiveServiceForOrderTariff(tid)
        : null;

    const linked = assertServiceLinkedToCourse(service);
    if (!linked.ok) {
      const status = service == null ? 404 : 400;
      return NextResponse.json({ error: linked.error }, { status });
    }

    const tariffIdToUse = orderTariffIdForStorage(service!);
    const amount = service!.price;
    const serviceName = service!.name;

    const orderNumber = `ALT-${nanoid(10)}`;

    try {
      await prisma.order.create({
        data: {
          orderNumber,
          tariffId: tariffIdToUse,
          amount,
          clientEmail: email.trim(),
          clientPhone: typeof phone === 'string' ? phone.trim() || null : null,
          status: 'pending',
        },
      });
    } catch (dbErr) {
      console.error('DB insert order:', dbErr);
      return NextResponse.json(
        { error: 'Ошибка создания заказа', success: false },
        { status: 500 }
      );
    }

    const baseUrl = (await getSystemSettings()).site_url?.replace(/\/$/, '') || '';

    if (amount <= 0) {
      const paid = await processPaidOrder(orderNumber);
      if (!paid.success) {
        return NextResponse.json(
          { error: paid.error || 'Не удалось оформить бесплатный доступ', success: false },
          { status: 500 }
        );
      }
      const paymentUrl = baseUrl
        ? `${baseUrl}/success?order=${encodeURIComponent(orderNumber)}`
        : `/success?order=${encodeURIComponent(orderNumber)}`;
      return NextResponse.json({
        success: true,
        paymentUrl,
        orderNumber,
        amount,
      });
    }

    let paymentUrl: string;
    try {
      paymentUrl = await createPayKeeperInvoice({
        sum: amount,
        orderid: orderNumber,
        clientid: email.trim(),
        service_name: `AVATERRA — ${serviceName}`,
        client_email: email.trim(),
        client_phone: typeof phone === 'string' ? phone.trim() || undefined : undefined,
        successRedirectUrl: baseUrl ? `${baseUrl}/success?order=${encodeURIComponent(orderNumber)}` : undefined,
      });
    } catch (pkErr) {
      console.error('PayKeeper create invoice:', pkErr);
      return NextResponse.json(
        {
          error: 'Ошибка создания платежа. Проверьте настройки PayKeeper.',
          success: false,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentUrl,
      orderNumber,
      amount,
    });
  } catch (error) {
    console.error('Payment create error:', error);
    return NextResponse.json(
      { error: 'Ошибка создания платежа', success: false },
      { status: 500 }
    );
  }
}
