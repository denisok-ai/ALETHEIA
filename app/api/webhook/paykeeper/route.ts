import { NextRequest, NextResponse } from 'next/server';
import {
  buildPayKeeperWebhookResponse,
  getPayKeeperConfigFromSettings,
  validatePayKeeperWebhook,
} from '@/lib/paykeeper';
import { prisma } from '@/lib/db';
import { processPaidOrder } from '@/lib/paykeeper-webhook-process';
import {
  maskEmailForLog,
  writePaykeeperIntegrationLog,
} from '@/lib/paykeeper-integration-log';
import { notifyAdminsTelegramAsync } from '@/lib/telegram-admin-notify';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = typeof value === 'string' ? value : value.toString();
    });

    const payloadPreview = {
      id: params.id,
      sum: params.sum,
      orderid: params.orderid,
      clientid: params.clientid ? maskEmailForLog(params.clientid) : params.clientid,
      key: params.key,
    };

    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'webhook.received',
      status: 'success',
      orderNumber: params.orderid || null,
      message: 'POST /api/webhook/paykeeper',
      payload: { paramKeys: Object.keys(params), ...payloadPreview },
    });

    const config = await getPayKeeperConfigFromSettings();
    const secret = config?.secret;
    if (!secret) {
      console.error('[PayKeeper webhook] config_missing secret not configured in settings');
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.config',
        status: 'error',
        orderNumber: params.orderid || null,
        message: 'secret not configured in SystemSetting',
      });
      return NextResponse.json({ error: 'Config error' }, { status: 500 });
    }
    if (!validatePayKeeperWebhook(params, secret)) {
      console.warn('[PayKeeper webhook] invalid_signature');
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.invalid_signature',
        status: 'error',
        orderNumber: params.orderid || null,
        message: 'MD5 подпись не совпала с секретом из настроек',
        payload: payloadPreview,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const { id, orderid, sum, clientid } = params;
    const order = await prisma.order.findUnique({
      where: { orderNumber: orderid },
    });

    if (!order) {
      console.error('Webhook: order not found', orderid);
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.order_not_found',
        status: 'error',
        orderNumber: orderid,
        message: 'Заказ с таким orderid не найден в БД',
        payload: { id, sum, clientid: maskEmailForLog(clientid) },
      });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const paidAmount = Number(sum);
    if (!Number.isFinite(paidAmount) || Math.round(paidAmount * 100) !== order.amount * 100) {
      console.warn('[PayKeeper webhook] amount_mismatch', { orderid, expected: order.amount, received: sum });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.amount_mismatch',
        status: 'error',
        orderNumber: orderid,
        message: `Сумма webhook (${sum}) ≠ сумме заказа (${order.amount})`,
        payload: { expectedRub: order.amount, receivedSum: sum },
      });
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }
    if (clientid && clientid.trim().toLowerCase() !== order.clientEmail.trim().toLowerCase()) {
      console.warn('[PayKeeper webhook] client_mismatch', { orderid, expected: order.clientEmail, received: clientid });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.client_mismatch',
        status: 'error',
        orderNumber: orderid,
        message: 'clientid не совпадает с email заказа',
        payload: {
          expected: maskEmailForLog(order.clientEmail),
          received: maskEmailForLog(clientid),
        },
      });
      return NextResponse.json({ error: 'Client mismatch' }, { status: 400 });
    }

    const paidAmountRub = Math.round(Number(sum));
    if (order.status === 'paid' && order.paykeeperPaymentId === id) {
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.idempotent',
        status: 'success',
        orderNumber: orderid,
        message: 'Повторное оповещение: заказ уже оплачен этим платежом PayKeeper',
        payload: { paykeeperId: id },
      });
      return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    if (order.status === 'paid') {
      await prisma.order
        .update({
          where: { orderNumber: orderid },
          data: {
            paykeeperPaymentId: order.paykeeperPaymentId ?? id,
            paykeeperStatus: order.paykeeperStatus ?? 'success',
            paidAmountRub: order.paidAmountRub ?? paidAmountRub,
          },
        })
        .catch(() => {});
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.already_paid_patch',
        status: 'success',
        orderNumber: orderid,
        message: 'Заказ уже оплачен — сохранён id PayKeeper без повторной выдачи доступа',
        payload: { paykeeperId: id },
      });
      return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const result = await processPaidOrder(orderid, {
      paykeeperPaymentId: id,
      paykeeperStatus: 'success',
      paidAmountRub,
    });
    if (!result.success) {
      console.error('[PayKeeper webhook] process_failed', { orderid, error: result.error });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.process_failed',
        status: 'error',
        orderNumber: orderid,
        message: result.error ?? 'processPaidOrder failed',
      });
      notifyAdminsTelegramAsync('paykeeper_webhook_error', [
        `Заказ: ${orderid}`,
        `Ошибка: ${result.error ?? 'processPaidOrder failed'}`,
      ]);
      return NextResponse.json({ error: result.error ?? 'Processing failed' }, { status: 500 });
    }

    if (result.warnings?.length) {
      console.warn('[PayKeeper webhook] ok_with_warnings', { orderid, warnings: result.warnings });
      await writePaykeeperIntegrationLog({
        direction: 'inbound',
        event: 'webhook.ok_with_warnings',
        status: 'warning',
        orderNumber: orderid,
        message: 'Оплата обработана с предупреждениями',
        payload: { warnings: result.warnings },
      });
    }
    console.info('[PayKeeper webhook] ok', {
      orderid,
      enrollmentCreated: result.enrollmentCreated,
      emailKind: result.emailKind,
    });
    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'webhook.ok',
      status: 'success',
      orderNumber: orderid,
      message: 'OK + processPaidOrder',
      payload: {
        paykeeperId: id,
        enrollmentCreated: result.enrollmentCreated,
        emailKind: result.emailKind,
        alreadyPaid: result.alreadyPaid,
      },
    });
    return new NextResponse(buildPayKeeperWebhookResponse(id, secret), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    console.error('Webhook error:', error);
    await writePaykeeperIntegrationLog({
      direction: 'inbound',
      event: 'webhook.exception',
      status: 'error',
      message: error instanceof Error ? error.message : 'Webhook processing failed',
    });
    notifyAdminsTelegramAsync('paykeeper_webhook_error', [
      `Исключение: ${error instanceof Error ? error.message : 'Webhook processing failed'}`,
    ]);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
