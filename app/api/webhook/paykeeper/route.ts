import { NextRequest, NextResponse } from 'next/server';
import {
  buildPayKeeperWebhookResponse,
  getPayKeeperConfigFromSettings,
  validatePayKeeperWebhook,
} from '@/lib/paykeeper';
import { prisma } from '@/lib/db';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : value.toString();
    });

    const config = await getPayKeeperConfigFromSettings();
    const secret = config?.secret;
    if (!secret) {
      console.error('[PayKeeper webhook] config_missing secret not configured in settings');
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    if (!validatePayKeeperWebhook(params, secret)) {
      console.warn('[PayKeeper webhook] invalid_signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const { id, orderid, sum, clientid } = params;
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderid },
    });

    if (!order) {
      console.error('Webhook: order not found', orderid);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const paidAmount = Number(sum);
    if (!Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== order.amount * 100) {
      console.warn('[PayKeeper webhook] amount_mismatch', { orderid, expected: order.amount, received: sum });
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }
    if (clientid && clientid.trim().toLowerCase() !== order.clientEmail.trim().toLowerCase()) {
      console.warn('[PayKeeper webhook] client_mismatch', { orderid, expected: order.clientEmail, received: clientid });
      return NextResponse.json({ error: 'Client mismatch' }, { status: 400 });
    }

    const result = await processPaidOrder(orderid);
    if (!result.success) {
      console.error('[PayKeeper webhook] process_failed', { orderid, error: result.error });
      return NextResponse.json({ error: result.error ?? 'Processing failed' }, { status: 500 });
    }

    if (result.warnings?.length) {
      console.warn('[PayKeeper webhook] ok_with_warnings', { orderid, warnings: result.warnings });
    }
    console.info('[PayKeeper webhook] ok', {
      orderid,
      enrollmentCreated: result.enrollmentCreated,
      emailKind: result.emailKind,
    });
    return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
