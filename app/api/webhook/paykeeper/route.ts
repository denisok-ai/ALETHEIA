import { NextRequest, NextResponse } from 'next/server';
import { validatePayKeeperWebhook, getPayKeeperConfigFromSettings } from '@/lib/paykeeper';
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

    const { orderid } = params;
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderid },
    });

    if (!order) {
      console.error('Webhook: order not found', orderid);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = await processPaidOrder(orderid);
    if (!result.success) {
      console.error('[PayKeeper webhook] process_failed', { orderid, error: result.error });
      return NextResponse.json({ error: result.error ?? 'Processing failed' }, { status: 500 });
    }

    console.info('[PayKeeper webhook] ok', { orderid });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
